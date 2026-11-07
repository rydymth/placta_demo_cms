import { Schema, model } from "mongoose";
import { PAGE_STATUSES } from "@placta/contracts";

const pageDbSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: { type: String, enum: [...PAGE_STATUSES], default: "draft", required: true },
    // Page content is validated by Zod (@placta/contracts), so Mongoose just stores it.
    draft: { type: Schema.Types.Mixed, required: true },
    published: { type: Schema.Types.Mixed, default: null },
    currentPublishedRevisionId: { type: Schema.Types.ObjectId, default: null },
    draftVersion: { type: Number, default: 1 },
    publishedDraftVersion: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    revisionCounter: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// The live URL is published.slug, not the draft slug. Two live pages may never share it.
pageDbSchema.index(
  { "published.slug": 1 },
  { unique: true, partialFilterExpression: { status: "published" } },
);

export const PageModel = model("Page", pageDbSchema);
