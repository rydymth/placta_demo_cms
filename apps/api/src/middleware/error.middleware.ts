import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiFailure } from "@placta/contracts";
import { isAppError } from "../utils/errors.ts";

interface HttpError {
  status: number;
  body: ApiFailure;
}

const failure = (status: number, code: string, message: string, details?: unknown): HttpError => ({
  status,
  body: {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  },
});

const isZodError = (err: any): boolean => err?.name === "ZodError" && Array.isArray(err.issues);

// Single place that decides what clients see. Unknown errors never leak details.
export const toHttpError = (err: any): HttpError => {
  if (isAppError(err)) return failure(err.status, err.code, err.message, err.details);
  if (isZodError(err)) {
    const details = err.issues.map((i: any) => ({ path: i.path.join("."), message: i.message }));
    return failure(400, "VALIDATION_ERROR", "Request validation failed", details);
  }
  switch (err?.name) {
    case "SlugTakenError":
      return failure(409, "SLUG_TAKEN", err.message);
    case "PageNotFoundError":
      return failure(404, "NOT_FOUND", err.message);
  }
  switch (err?.type) {
    case "entity.parse.failed":
      return failure(400, "BAD_JSON", "Request body is not valid JSON");
    case "entity.too.large":
      return failure(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return failure(500, "INTERNAL", "Something went wrong");
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  const { status, body } = failure(404, "NOT_FOUND", "Route not found");
  res.status(status).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = toHttpError(err);
  if (status >= 500) console.error(err);
  res.status(status).json(body);
};
