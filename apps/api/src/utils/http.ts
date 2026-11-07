import type { ApiSuccess } from "@placta/contracts";

export const ok = <T>(data: T, message?: string): ApiSuccess<T> =>
  message === undefined ? { success: true, data } : { success: true, data, message };
