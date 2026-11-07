import type { RequestHandler } from "express";
import { tooManyRequests } from "../utils/errors.ts";

interface Window {
  count: number;
  resetAt: number;
}

// In-memory, per IP. Fine for one API instance; use a shared store if you scale out.
export const rateLimit = (opts: { windowMs: number; max: number }): RequestHandler => {
  const hits = new Map<string, Window>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const current = hits.get(key);
    const base: Window = !current || current.resetAt <= now ? { count: 0, resetAt: now + opts.windowMs } : current;
    const updated: Window = { ...base, count: base.count + 1 };
    hits.set(key, updated);

    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    if (updated.count > opts.max) return next(tooManyRequests());
    next();
  };
};
