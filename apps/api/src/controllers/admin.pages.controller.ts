import type { Request, Response } from "express";
import * as pagesService from "../services/pages.service.ts";
import {
  toDetailDto,
  toRevisionDto,
  toRevisionMetaDto,
  toSummaryDto,
} from "../mappers/page.mappers.ts";
import { getAuth } from "../middleware/auth.middleware.ts";
import { requestContext } from "./auth.controller.ts";
import { recordAudit } from "../services/audit.service.ts";
import { ok } from "../utils/http.ts";
import * as locks from "../services/edit-lock.service.ts";

const idOf = (req: Request): string => String(req.params["id"]);

export async function list(_req: Request, res: Response) {
  res.json(ok((await pagesService.listPages()).map(toSummaryDto)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(ok(toDetailDto(await pagesService.createPage(req.body)), "Page created"));
}

export async function get(req: Request, res: Response) {
  res.json(ok(toDetailDto(await pagesService.getPage(idOf(req)))));
}

export async function saveDraft(req: Request, res: Response) {
  await locks.requireEditLock(idOf(req), getAuth(res).id);
  res.json(ok(toDetailDto(await pagesService.saveDraft(idOf(req), req.body)), "Draft saved"));
}

export async function remove(req: Request, res: Response) {
  await locks.requireEditLock(idOf(req), getAuth(res).id);
  await pagesService.removePage(idOf(req));
  recordAudit({ action: "page.deleted", userId: getAuth(res).id, ...requestContext(req), meta: { pageId: idOf(req) } });
  res.json(ok(null, "Page deleted"));
}

export async function duplicate(req: Request, res: Response) {
  await locks.requireEditLock(idOf(req), getAuth(res).id);
  res.status(201).json(ok(toDetailDto(await pagesService.duplicatePage(idOf(req))), "Page duplicated"));
}

export async function publish(req: Request, res: Response) {
  const user = getAuth(res);
  await locks.requireEditLock(idOf(req), user.id);
  const record = await pagesService.publishPage(idOf(req), user.id);
  recordAudit({ action: "page.published", userId: user.id, ...requestContext(req), meta: { pageId: record.id } });
  res.json(ok(toDetailDto(record), "Page published"));
}

export async function unpublish(req: Request, res: Response) {
  await locks.requireEditLock(idOf(req), getAuth(res).id);
  const record = await pagesService.unpublishPage(idOf(req));
  recordAudit({ action: "page.unpublished", userId: getAuth(res).id, ...requestContext(req), meta: { pageId: record.id } });
  res.json(ok(toDetailDto(record), "Page unpublished"));
}

export async function revisions(req: Request, res: Response) {
  res.json(ok((await pagesService.listRevisions(idOf(req))).map(toRevisionMetaDto)));
}

export async function revision(req: Request, res: Response) {
  const found = await pagesService.getRevision(idOf(req), String(req.params["revisionId"]));
  res.json(ok(toRevisionDto(found)));
}
