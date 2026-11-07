import { hash, verify } from "@node-rs/argon2";
import type { SessionDto, UserDto } from "@placta/contracts";
import * as repo from "../repositories/auth.repository.ts";
import type { UserRecord } from "../repositories/auth.repository.ts";
import { signAccessToken } from "./token.service.ts";
import { recordAudit } from "./audit.service.ts";
import config from "../utils/config.ts";
import { randomToken, sha256 } from "../utils/crypto.ts";
import { conflict, forbidden, unauthorized } from "../utils/errors.ts";
import { isDupeKey } from "../utils/mongo.ts";

export interface RequestContext {
  ip: string;
  userAgent: string;
}

export interface Session extends SessionDto {
  refreshToken: string;
}

// A second tab refreshing with the same cookie is not theft; allow a short grace window.
const REUSE_GRACE_MS = 10_000;

// Verifying against this when the user does not exist keeps response time the same.
const dummyHash = hash("placta-timing-equalizer");

export const toUserDto = (u: UserRecord): UserDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});

export const hashPassword = (password: string): Promise<string> => hash(password);

const checkPassword = async (passwordHash: string | null, password: string): Promise<boolean> => {
  const matches = await verify(passwordHash ?? (await dummyHash), password).catch(() => false);
  return passwordHash !== null && matches;
};

export async function issueSession(user: UserRecord, ctx: RequestContext): Promise<Session> {
  const refreshToken = randomToken(48);
  const refreshRecord = await repo.createRefreshToken({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 86_400_000),
    userAgent: ctx.userAgent,
  });
  return {
    accessToken: await signAccessToken(user.id, String(refreshRecord._id)),
    refreshToken,
    expiresIn: config.accessTokenTtlSeconds,
    user: toUserDto(user),
  };
}

export async function loginWithPassword(
  email: string,
  password: string,
  ctx: RequestContext,
): Promise<Session> {
  const user = await repo.findUserByEmail(email);
  const valid = await checkPassword(user?.passwordHash ?? null, password);
  if (!user || !valid) {
    recordAudit({ action: "login.failed", ...ctx, meta: { email } });
    throw unauthorized("Invalid email or password");
  }

  recordAudit({ action: "login.password", userId: user.id, ...ctx });
  return issueSession(user, ctx);
}

export async function register(email: string, name: string, password: string, ctx: RequestContext): Promise<Session> {
  try {
    const user = await repo.createUser({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      passwordHash: await hashPassword(password),
      role: "admin",
    });
    recordAudit({ action: "user.registered", userId: user.id, ...ctx });
    return issueSession(user, ctx);
  }
  catch (err) {
    if (isDupeKey(err)) throw conflict("An account already exists for this email", "EMAIL_TAKEN");
    throw err;
  }
}

// Used before sensitive actions (adding or removing a passkey).
export async function assertPassword(userId: string, password: string): Promise<void> {
  const user = await repo.findUserById(userId);
  if (!user || !(await checkPassword(user.passwordHash, password))) {
    throw forbidden("Password is incorrect", "REAUTH_FAILED");
  }
}

// Rotating: the presented token is spent and a fresh one is issued.
export async function refreshSession(raw: string | undefined, ctx: RequestContext): Promise<Session> {
  if (!raw) throw unauthorized("No session");
  const token = await repo.findRefreshByHash(sha256(raw));
  if (!token) throw unauthorized("Invalid session");

  if (token.revokedAt) {
    if (Date.now() - token.revokedAt.getTime() > REUSE_GRACE_MS) {
      await repo.revokeAllRefreshForUser(token.userId);
      recordAudit({ action: "refresh.reuse_detected", userId: token.userId, ...ctx });
    }
    throw unauthorized("Session revoked");
  }
  if (token.expiresAt.getTime() <= Date.now()) throw unauthorized("Session expired");
  if (!(await repo.revokeRefreshIfActive(token.id))) throw unauthorized("Session revoked");

  const user = await repo.findUserById(token.userId);
  if (!user) throw unauthorized("Invalid session");
  return issueSession(user, ctx);
}

export async function endSession(raw: string | undefined): Promise<void> {
  if (!raw) return;
  const token = await repo.findRefreshByHash(sha256(raw));
  if (token) await repo.revokeRefreshIfActive(token.id);
}
