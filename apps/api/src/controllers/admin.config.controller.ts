import type { Request, Response } from "express";
import config from "../utils/config.ts";
import { ok } from "../utils/http.ts";

export const siteUrl = (_req: Request, res: Response) => {
  res.json(ok({ publicOrigin: config.publicOrigin }));
};
