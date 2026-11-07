export interface AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
}

export const appError = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
): AppError => Object.assign(new Error(message), { name: "AppError", status, code, details });

export const isAppError = (err: unknown): err is AppError =>
  err instanceof Error && err.name === "AppError";

export const badRequest = (message: string, details?: unknown) =>
  appError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") =>
  appError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden", code = "FORBIDDEN") =>
  appError(403, code, message);
export const notFound = (message = "Not found") => appError(404, "NOT_FOUND", message);
export const conflict = (message: string, code = "CONFLICT") => appError(409, code, message);
export const tooManyRequests = (message = "Too many requests, try again later") =>
  appError(429, "RATE_LIMITED", message);
