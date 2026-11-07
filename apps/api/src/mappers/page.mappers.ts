import type { PageDetailDto, PageSummaryDto, RevisionDto, RevisionMetaDto } from "@placta/contracts";
import type {
  PageRecord,
  PageSummaryRecord,
  RevisionRecord,
} from "../repositories/pages.repository.ts";

const iso = (d: Date): string => new Date(d).toISOString();

export const hasUnpublishedChanges = (r: PageSummaryRecord): boolean =>
  r.status === "published" && r.publishedDraftVersion !== r.draftVersion;

export const toSummaryDto = (r: PageSummaryRecord): PageSummaryDto => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  status: r.status,
  draftVersion: r.draftVersion,
  hasUnpublishedChanges: hasUnpublishedChanges(r),
  publishedAt: r.publishedAt ? iso(r.publishedAt) : null,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

export const toDetailDto = (r: PageRecord): PageDetailDto => ({
  ...toSummaryDto(r),
  draft: r.draft,
  published: r.published,
  currentPublishedRevisionId: r.currentPublishedRevisionId,
});

export const toRevisionMetaDto = (r: RevisionRecord): RevisionMetaDto => ({
  id: r.id,
  pageId: r.pageId,
  version: r.version,
  title: r.title,
  slug: r.slug,
  publishedAt: iso(r.publishedAt),
});

export const toRevisionDto = (r: RevisionRecord): RevisionDto => ({
  ...toRevisionMetaDto(r),
  snapshot: r.snapshot,
});
