import { type Page } from "@placta/contracts";
import { type Types, Schema, model } from "mongoose";

interface Revision {
  pageId: Types.ObjectId;
  version: number;
  title: string;
  slug: string;
  snapshot: Page;
  publishedBy: Types.ObjectId | null;
  publishedAt: Date;
}

const revisionDbSchema = new Schema<Revision>(
  {
    pageId: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    publishedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: "publishedAt", updatedAt: false } },
);

revisionDbSchema.index({ pageId: 1, version: 1 }, { unique: true });

export const RevisionModel = model<Revision>("PageRevision", revisionDbSchema);
