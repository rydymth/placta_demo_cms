import mongoose from "mongoose";
import { pageSchema, type Page, type PageStatus } from "@placta/contracts";
import { PageModel } from "../models/page.model.ts";
import { RevisionModel } from "../models/revision.model.ts";
import { isDupeKey } from "../utils/mongo.ts";

/*
 * Exports
*/

export interface PageSummaryRecord {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  draftVersion: number;
  publishedDraftVersion: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageRecord extends PageSummaryRecord {
  draft: Page;
  published: Page | null;
  currentPublishedRevisionId: string | null;
}

export interface RevisionRecord {
  id: string;
  pageId: string;
  version: number;
  title: string;
  slug: string;
  snapshot: Page;
  publishedAt: Date;
}

export interface NavRecord {
  title: string;
  slug: string;
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already in use`);
    this.name = "SlugTakenError";
  }
}

export class DraftChangedError extends Error {
  constructor() {
    super("The draft changed while publishing, please try again");
    this.name = "DraftChangedError";
  }
}

export async function createPage(page: Page): Promise<PageRecord> {
  try {
    const doc = await PageModel.create({
      title: page.title,
      slug: page.slug,
      draft: page
    })
    return toRecord(doc.toObject());
  }
  catch (err) {
    if (isDupeKey(err)) throw new SlugTakenError(page.slug)
    throw err; // if not dupe
  }
}

export async function listPages(): Promise<PageSummaryRecord[]> {
  const docs = await PageModel.find({}, { draft: 0, published: 0 }).sort({ updatedAt: -1 }).lean();
  return docs.map(toSummary);
}

export async function findPageById(id: string): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PageModel.findById(id).lean();
  return doc ? toRecord(doc) : null;
}

export async function findPageBySlug(slug: string): Promise<PageRecord | null> {
  const doc = await PageModel.findOne({ slug }).lean();
  return doc ? toRecord(doc) : null;
}

export async function updateDraft(id: string, page: Page): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  try {
    const doc = await PageModel.findByIdAndUpdate(
      id,
      // Only draft-related fields. Never touch `published` or `status` here.
      { $set: { title: page.title, slug: page.slug, draft: page }, $inc: { draftVersion: 1 } },
      { new: true },
    ).lean();
    return doc ? toRecord(doc) : null;
  }
  catch (err) {
    if (isDupeKey(err)) throw new SlugTakenError(page.slug);
    throw err;
  }
}

export async function deletePage(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const doc = await PageModel.findByIdAndDelete(id).lean();
  if (!doc) return false;
  await RevisionModel.deleteMany({ pageId: id });
  return true;
}

// Copies the current draft into an immutable revision, then makes it the live version.
export async function publishDraft(id: string, userId: string | null): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const current = await PageModel.findById(id).lean();
  if (!current) return null;

  const counted = await PageModel.findByIdAndUpdate(
    id,
    { $inc: { revisionCounter: 1 } },
    { new: true, projection: { revisionCounter: 1 } },
  ).lean();
  if (!counted) return null;

  const snapshot = pageSchema.parse(current.draft);
  const revision = await RevisionModel.create({
    pageId: id,
    version: counted.revisionCounter,
    title: snapshot.title,
    slug: snapshot.slug,
    snapshot,
    publishedBy: userId,
  });

  try {
    // Matching draftVersion makes sure we publish exactly what we snapshotted.
    const doc = await PageModel.findOneAndUpdate(
      { _id: id, draftVersion: current.draftVersion, status: current.status, currentPublishedRevisionId: current.currentPublishedRevisionId ?? null },
      {
        $set: {
          status: "published",
          published: snapshot,
          currentPublishedRevisionId: revision._id,
          publishedDraftVersion: current.draftVersion,
          publishedAt: new Date(),
        },
      },
      { new: true },
    ).lean();
    if (!doc) throw new DraftChangedError();
    return toRecord(doc);
  }
  catch (err) {
    await RevisionModel.deleteOne({ _id: revision._id });
    if (isDupeKey(err)) throw new SlugTakenError(snapshot.slug);
    throw err;
  }
}

// Keeps the published snapshot so the page can be re-published, but takes it off the site.
export async function markUnpublished(id: string): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PageModel.findOneAndUpdate(
    { _id: id, status: "published" },
    { $set: { status: "unpublished" } },
    { new: true },
  ).lean();
  return doc ? toRecord(doc) : null;
}

export async function findPublishedBySlug(slug: string): Promise<Page | null> {
  const doc = await PageModel.findOne({ status: "published", "published.slug": slug }, { published: 1 }).lean();
  return doc ? (doc.published as Page) : null;
}

export async function listPublishedNav(): Promise<NavRecord[]> {
  const docs = await PageModel.find(
    { status: "published" },
    { "published.title": 1, "published.slug": 1 },
  ).lean();
  return docs.map((d: any) => ({ title: d.published.title, slug: d.published.slug }));
}

export async function listRevisions(pageId: string): Promise<RevisionRecord[]> {
  if (!mongoose.isValidObjectId(pageId)) return [];
  const docs = await RevisionModel.find({ pageId }, { snapshot: 0 }).sort({ version: -1 }).lean();
  return docs.map((d) => toRevision(d, null));
}

export async function findRevision(pageId: string, revisionId: string): Promise<RevisionRecord | null> {
  if (!mongoose.isValidObjectId(pageId) || !mongoose.isValidObjectId(revisionId)) return null;
  const doc = await RevisionModel.findOne({ _id: revisionId, pageId }).lean();
  return doc ? toRevision(doc, doc.snapshot as Page) : null;
}

/*
  * Private functions!
*/

function toSummary(doc: any): PageSummaryRecord {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    draftVersion: doc.draftVersion,
    publishedDraftVersion: doc.publishedDraftVersion ?? null,
    publishedAt: doc.publishedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Convert a Mongo document into a plain object so Mongoose details don't leak upward.
function toRecord(doc: any): PageRecord {
  return {
    ...toSummary(doc),
    draft: doc.draft,
    published: doc.published ?? null, // can be null if not published
    currentPublishedRevisionId: doc.currentPublishedRevisionId
      ? String(doc.currentPublishedRevisionId)
      : null,
  };
}

function toRevision(doc: any, snapshot: Page | null): RevisionRecord {
  return {
    id: String(doc._id),
    pageId: String(doc.pageId),
    version: doc.version,
    title: doc.title,
    slug: doc.slug,
    snapshot: snapshot as Page,
    publishedAt: doc.publishedAt,
  };
}
