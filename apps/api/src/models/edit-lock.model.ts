import { Schema, model } from "mongoose";

const editLockDbSchema = new Schema(
  {
    pageId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: false },
);

export const EditLockModel = model("PageEditLock", editLockDbSchema);
