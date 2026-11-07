import type { Request } from "express";

export const readCookie = (req: Request, name: string): string | undefined =>
  (req.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split(/=(.*)/s))
    .filter(([key]) => key === name)
    .map(([, value]) => decodeURIComponent(value ?? ""))
    .at(0);
