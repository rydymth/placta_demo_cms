import { pageSchema, slugSchema } from "@placta/contracts";
import type { Page } from "@placta/contracts";
import * as pageRepo from "../repositories/pages.repository.ts";
import type {
  NavRecord,
  PageRecord,
  PageSummaryRecord,
  RevisionRecord,
} from "../repositories/pages.repository.ts";
import { appError, conflict } from "../utils/errors.ts";

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page ${id} not found`);
    this.name = "PageNotFoundError"
  }
}

const orNotFound = <T>(id: string) => (value: T | null): T => {
  if (value === null) throw new PageNotFoundError(id);
  return value;
};

export async function createPage(inp: unknown): Promise<PageRecord> {
  const page = pageSchema.parse(inp); // zod error handling so no need to wire in try catch
  return pageRepo.createPage(page);
}

export const listPages = (): Promise<PageSummaryRecord[]> => pageRepo.listPages();

export async function getPage(id: string): Promise<PageRecord> {
  const record = await pageRepo.findPageById(id);
  if (!record) throw new PageNotFoundError(id);
  return record;
}

export async function saveDraft(id: string, inp: unknown): Promise<PageRecord> {
  const page = pageSchema.parse(inp);
  const record = await pageRepo.updateDraft(id, page);
  if (!record) throw new PageNotFoundError(id);
  return record;
}

export async function removePage(id: string): Promise<void> {
  orNotFound<boolean>(id)((await pageRepo.deletePage(id)) || null);
}

export async function duplicatePage(id: string): Promise<PageRecord> {
  const source = await getPage(id);
  const slug = await freeCopySlug(source.draft.slug);
  const copy: Page = {
    ...source.draft,
    title: `${source.draft.title} (copy)`.slice(0, 200),
    slug,
  };
  return createPage(copy);
}

export async function publishPage(id: string, userId: string): Promise<PageRecord> {
  const record = await getPage(id);
  // Re-validate: a draft stored by an older schema version must not reach the public site.
  pageSchema.parse(record.draft);
  try {
    return orNotFound<PageRecord>(id)(await pageRepo.publishDraft(id, userId));
  }
  catch (err) {
    if (err instanceof pageRepo.DraftChangedError) throw conflict(err.message, "DRAFT_CHANGED");
    throw err;
  }
}

export async function unpublishPage(id: string): Promise<PageRecord> {
  const record = await pageRepo.markUnpublished(id);
  if (record) return record;
  await getPage(id); // 404 when missing
  throw conflict("Page is not published", "NOT_PUBLISHED");
}

export async function listRevisions(id: string): Promise<RevisionRecord[]> {
  await getPage(id);
  return pageRepo.listRevisions(id);
}

export async function getRevision(id: string, revisionId: string): Promise<RevisionRecord> {
  return orNotFound<RevisionRecord>(revisionId)(await pageRepo.findRevision(id, revisionId));
}

// Public reads. Only ever look at the published snapshot.
export async function getPublishedPage(slug: string): Promise<Page | null> {
  if (!slugSchema.safeParse(slug).success) return null;
  return pageRepo.findPublishedBySlug(slug);
}

export async function getNavigation(): Promise<NavRecord[]> {
  const items = await pageRepo.listPublishedNav();
  return [...items].sort((a, b) =>
    a.slug === "/" ? -1 : b.slug === "/" ? 1 : a.title.localeCompare(b.title),
  );
}

async function freeCopySlug(slug: string): Promise<string> {
  const base = (slug === "/" ? "home" : slug).slice(0, 80).replace(/-+$/, "");
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? `${base}-copy` : `${base}-copy-${n}`;
    if (!(await pageRepo.findPageBySlug(candidate))) return candidate;
  }
  throw appError(409, "SLUG_TAKEN", "Could not find a free slug for the copy");
}
