import type { RequestHandler } from "express";
import config from "../utils/config.ts";
import { forbidden } from "../utils/errors.ts";

// Cookie-carrying endpoints only accept requests that come from the admin app.
export const requireAdminOrigin: RequestHandler = (req, _res, next) => {
  if (req.headers.origin !== config.adminOrigin) throw forbidden("Origin not allowed", "BAD_ORIGIN");
  next();
};
