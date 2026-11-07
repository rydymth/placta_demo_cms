import type { Request, Response } from "express";
import { getAuth } from "../middleware/auth.middleware.ts";
import * as locks from "../services/edit-lock.service.ts";
import { ok } from "../utils/http.ts";

const pageId = (req: Request) => String(req.params["id"]);

export async function acquire(req: Request, res: Response) {
  res.json(ok(await locks.acquireEditLock(pageId(req), getAuth(res).id)));
}

export async function renew(req: Request, res: Response) {
  res.json(ok(await locks.renewEditLock(pageId(req), getAuth(res).id)));
}

export async function release(req: Request, res: Response) {
  await locks.releaseEditLock(pageId(req), getAuth(res).id);
  res.json(ok(null));
}
