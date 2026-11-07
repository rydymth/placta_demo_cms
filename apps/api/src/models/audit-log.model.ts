import { Schema, model } from "mongoose";

const auditLogDbSchema = new Schema(
  {
    action: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLogModel = model("AuditLog", auditLogDbSchema);
