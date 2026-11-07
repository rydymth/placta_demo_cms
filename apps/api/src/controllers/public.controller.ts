import type { Request, Response } from "express";
import * as pagesService from "../services/pages.service.ts";
import { notFound } from "../utils/errors.ts";
import { ok } from "../utils/http.ts";
import config from "../utils/config.ts";

// Published content changes when someone clicks Publish, so always revalidate.
const noCache = (res: Response) => res.set("Cache-Control", "no-cache");

export async function getPage(req: Request, res: Response) {
  const slug = req.query["slug"];
  if (typeof slug !== "string") throw notFound("Page not found");
  const page = await pagesService.getPublishedPage(slug);
  if (!page) throw notFound("Page not found");
  noCache(res).json(ok(page));
}

export async function navigation(_req: Request, res: Response) {
  noCache(res).json(ok(await pagesService.getNavigation()));
}

export function site(req: Request, res: Response) {
  res.json(ok({ publicOrigin: config.publicOrigin }));
}
