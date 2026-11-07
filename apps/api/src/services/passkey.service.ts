import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { UserDto } from "@placta/contracts";
import * as repo from "../repositories/auth.repository.ts";
import type { PasskeyRecord } from "../repositories/auth.repository.ts";
import { issueSession } from "./auth.service.ts";
import type { RequestContext, Session } from "./auth.service.ts";
import { recordAudit } from "./audit.service.ts";
import config from "../utils/config.ts";
import { randomToken } from "../utils/crypto.ts";
import { badRequest, conflict, notFound, unauthorized } from "../utils/errors.ts";
import { isDupeKey } from "../utils/mongo.ts";

const CHALLENGE_TTL_MS = 5 * 60_000;

const toBytes = (b64url: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(Buffer.from(b64url, "base64url"));
const toB64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const transportsOf = (p: PasskeyRecord) => p.transports as AuthenticatorTransportFuture[];

const storeChallenge = async (
  type: "register" | "login",
  challenge: string,
  userId?: string,
): Promise<string> => {
  const flowId = randomToken(16);
  await repo.saveChallenge({
    flowId,
    type,
    challenge,
    userId,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return flowId;
};

// ---- registration (signed-in user adds a passkey) ----

export async function beginRegistration(user: UserDto) {
  const existing = await repo.listActivePasskeys(user.id);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: transportsOf(p) })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const flowId = await storeChallenge("register", options.challenge, user.id);
  return { flowId, options };
}

export async function finishRegistration(
  user: UserDto,
  flowId: string,
  response: RegistrationResponseJSON,
  name: string | undefined,
  ctx: RequestContext,
): Promise<PasskeyRecord> {
  const challenge = await repo.consumeChallenge(flowId, "register");
  if (!challenge || challenge.userId !== user.id) throw badRequest("Challenge expired, try again");

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.adminOrigin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified || !result.registrationInfo) throw badRequest("Passkey verification failed");

  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  try {
    const passkey = await repo.createPasskey({
      userId: user.id,
      credentialId: credential.id,
      publicKey: toB64url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name ?? "Passkey",
    });
    recordAudit({ action: "passkey.registered", userId: user.id, ...ctx });
    return passkey;
  }
  catch (err) {
    if (isDupeKey(err)) throw conflict("This passkey is already registered");
    throw err;
  }
}

export async function removePasskey(user: UserDto, id: string, ctx: RequestContext): Promise<void> {
  if (!(await repo.revokePasskey(user.id, id))) throw notFound("Passkey not found");
  recordAudit({ action: "passkey.revoked", userId: user.id, ...ctx, meta: { passkeyId: id } });
}

// ---- login (usernameless, discoverable credentials) ----

export async function beginLogin() {
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: "required",
  });
  const flowId = await storeChallenge("login", options.challenge);
  return { flowId, options };
}

export async function finishLogin(
  flowId: string,
  response: AuthenticationResponseJSON,
  ctx: RequestContext,
): Promise<Session> {
  const challenge = await repo.consumeChallenge(flowId, "login");
  if (!challenge) throw unauthorized("Challenge expired, try again");

  const passkey = await repo.findPasskeyByCredentialId(response.id);
  if (!passkey || passkey.revokedAt) throw unauthorized("Unknown passkey");

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.adminOrigin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: toBytes(passkey.publicKey),
      counter: passkey.counter,
      transports: transportsOf(passkey),
    },
  }).catch(() => null);
  if (!result?.verified) {
    recordAudit({ action: "login.passkey_failed", userId: passkey.userId, ...ctx });
    throw unauthorized("Passkey verification failed");
  }

  const updated = await repo.touchPasskey(passkey.id, passkey.counter, result.authenticationInfo.newCounter);
  if (updated.matchedCount !== 1) throw unauthorized("Passkey changed, try again");
  const user = await repo.findUserById(passkey.userId);
  if (!user) throw unauthorized("Unknown user");
  recordAudit({ action: "login.passkey", userId: user.id, ...ctx });
  return issueSession(user, ctx);
}
