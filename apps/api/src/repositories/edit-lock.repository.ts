import mongoose from "mongoose";
import { EditLockModel } from "../models/edit-lock.model.ts";
import { isDupeKey } from "../utils/mongo.ts";

const LEASE_MS = 90_000;

export interface EditLockRecord {
  userId: string;
  userName: string;
  expiresAt: Date;
}

const toRecord = (doc: any): EditLockRecord => ({
  userId: String(doc.userId._id ?? doc.userId),
  userName: doc.userId.name ?? "Another user",
  expiresAt: doc.expiresAt,
});

export async function acquire(pageId: string, userId: string): Promise<EditLockRecord | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_MS);
  try {
    const doc = await EditLockModel.findOneAndUpdate(
      { pageId, $or: [{ userId }, { expiresAt: { $lte: now } }] },
      { $set: { userId, expiresAt } },
      { new: true, upsert: true },
    ).populate("userId", "name").lean();
    return doc ? toRecord(doc) : null;
  }
  catch (err) {
    if (!isDupeKey(err)) throw err;
    return null;
  }
}

export async function getActive(pageId: string): Promise<EditLockRecord | null> {
  if (!mongoose.isValidObjectId(pageId)) return null;
  const doc = await EditLockModel.findOne({ pageId, expiresAt: { $gt: new Date() } })
    .populate("userId", "name")
    .lean();
  return doc ? toRecord(doc) : null;
}

export const renew = (pageId: string, userId: string): Promise<boolean> =>
  EditLockModel.updateOne(
    { pageId, userId, expiresAt: { $gt: new Date() } },
    { $set: { expiresAt: new Date(Date.now() + LEASE_MS) } },
  ).then(result => result.matchedCount === 1);

export const release = (pageId: string, userId: string) =>
  EditLockModel.deleteOne({ pageId, userId });
