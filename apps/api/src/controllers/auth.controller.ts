import type { Request, Response } from "express";
import { loginRequestSchema, registerRequestSchema } from "@placta/contracts";
import * as authService from "../services/auth.service.ts";
import type { RequestContext, Session } from "../services/auth.service.ts";
import * as passkeyService from "../services/passkey.service.ts";
import { passkeyAuthVerifySchema } from "@placta/contracts";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getAuth } from "../middleware/auth.middleware.ts";
import config from "../utils/config.ts";
import { readCookie } from "../utils/cookies.ts";
import { ok } from "../utils/http.ts";

const COOKIE = "placta_refresh";

const cookieBase = () => ({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: config.isProd,
  path: "/api/v1/auth",
});

export const requestContext = (req: Request): RequestContext => ({
  ip: req.ip ?? "",
  userAgent: String(req.headers["user-agent"] ?? "").slice(0, 200),
});

const sendSession = (res: Response, { refreshToken, ...session }: Session): void => {
  res.cookie(COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: config.refreshTokenTtlDays * 86_400_000,
  });
  res.json(ok(session));
};

export async function login(req: Request, res: Response) {
  const { email, password } = loginRequestSchema.parse(req.body);
  sendSession(res, await authService.loginWithPassword(email, password, requestContext(req)));
}

export async function register(req: Request, res: Response) {
  const { email, name, password } = registerRequestSchema.parse(req.body);
  sendSession(res, await authService.register(email, name, password, requestContext(req)));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, await authService.refreshSession(readCookie(req, COOKIE), requestContext(req)));
  }
  catch (err) {
    res.clearCookie(COOKIE, cookieBase());
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.endSession(readCookie(req, COOKIE));
  res.clearCookie(COOKIE, cookieBase());
  res.json(ok(null));
}

export const me = (_req: Request, res: Response) => {
  res.json(ok(getAuth(res)));
};

export async function passkeyOptions(_req: Request, res: Response) {
  res.json(ok(await passkeyService.beginLogin()));
}

export async function passkeyVerify(req: Request, res: Response) {
  const { flowId, response } = passkeyAuthVerifySchema.parse(req.body);
  sendSession(
    res,
    await passkeyService.finishLogin(
      flowId,
      response as unknown as AuthenticationResponseJSON,
      requestContext(req),
    ),
  );
}
