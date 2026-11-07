import { AuditLogModel } from "../models/audit-log.model.ts";

export interface AuditEntry {
  action: string;
  userId?: string | null;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}

// Fire and forget: a failed audit write must never break the request.
export const recordAudit = (entry: AuditEntry): void => {
  AuditLogModel.create(entry).catch((err) => console.error("audit write failed:", err));
};
