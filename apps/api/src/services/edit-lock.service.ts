import * as locks from "../repositories/edit-lock.repository.ts";
import { conflict } from "../utils/errors.ts";

export interface EditLockStatus {
  held: boolean;
  ownerName: string;
  expiresAt: Date;
}

export async function acquireEditLock(pageId: string, userId: string): Promise<EditLockStatus> {
  const lock = await locks.acquire(pageId, userId);
  if (lock?.userId === userId) return { held: true, ownerName: lock.userName, expiresAt: lock.expiresAt };

  const active = await locks.getActive(pageId);
  if (!active) return acquireEditLock(pageId, userId);
  return { held: active.userId === userId, ownerName: active.userName, expiresAt: active.expiresAt };
}

export async function renewEditLock(pageId: string, userId: string): Promise<EditLockStatus> {
  if (await locks.renew(pageId, userId)) {
    const lock = await locks.getActive(pageId);
    if (lock) return { held: true, ownerName: lock.userName, expiresAt: lock.expiresAt };
  }
  const active = await locks.getActive(pageId);
  if (!active) return acquireEditLock(pageId, userId);
  return { held: false, ownerName: active.userName, expiresAt: active.expiresAt };
}

export const releaseEditLock = (pageId: string, userId: string) => locks.release(pageId, userId);

export async function requireEditLock(pageId: string, userId: string): Promise<void> {
  const active = await locks.getActive(pageId);
  if (!active || active.userId !== userId) {
    throw conflict(active ? `${active.userName} is editing this page` : "Acquire the edit lock before changing this page", "EDIT_LOCKED");
  }
}
