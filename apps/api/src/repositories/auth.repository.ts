import mongoose from "mongoose";
import { UserModel } from "../models/user.model.ts";
import { PasskeyModel } from "../models/passkey.model.ts";
import { RefreshTokenModel } from "../models/refresh-token.model.ts";
import { AuthChallengeModel } from "../models/auth-challenge.model.ts";

export type Role = "admin" | "editor";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export interface RefreshRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface PasskeyRecord {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface ChallengeRecord {
  challenge: string;
  userId: string | null;
}

const validId = (id: string) => mongoose.isValidObjectId(id);

// ---- users ----

const toUser = (d: any): UserRecord => ({
  id: String(d._id),
  email: d.email,
  name: d.name,
  role: d.role,
  passwordHash: d.passwordHash,
});

export const countUsers = (): Promise<number> => UserModel.countDocuments();

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const doc = await UserModel.findOne({ email: email.trim().toLowerCase(), isActive: { $ne: false } }).lean();
  return doc ? toUser(doc) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!validId(id)) return null;
  const doc = await UserModel.findOne({ _id: id, isActive: { $ne: false } }).lean();
  return doc ? toUser(doc) : null;
}

export async function createUser(input: Omit<UserRecord, "id">): Promise<UserRecord> {
  const doc = await UserModel.create(input);
  return toUser(doc.toObject());
}

export const setPasswordHash = (id: string, passwordHash: string) =>
  UserModel.updateOne({ _id: id }, { $set: { passwordHash } });

// ---- refresh tokens ----

const toRefresh = (d: any): RefreshRecord => ({
  id: String(d._id),
  userId: String(d.userId),
  expiresAt: d.expiresAt,
  revokedAt: d.revokedAt ?? null,
});

export const createRefreshToken = (input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string;
}) => RefreshTokenModel.create(input);

export async function findRefreshByHash(tokenHash: string): Promise<RefreshRecord | null> {
  const doc = await RefreshTokenModel.findOne({ tokenHash }).lean();
  return doc ? toRefresh(doc) : null;
}

// Atomic: only one caller can ever claim a token.
export async function revokeRefreshIfActive(id: string): Promise<boolean> {
  const doc = await RefreshTokenModel.findOneAndUpdate(
    { _id: id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).lean();
  return doc !== null;
}

export const revokeAllRefreshForUser = (userId: string) =>
  RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

// ---- challenges ----

export const saveChallenge = (input: {
  flowId: string;
  type: "register" | "login";
  challenge: string;
  userId?: string;
  expiresAt: Date;
}) => AuthChallengeModel.create(input);

// Deleting on read makes every challenge single-use.
export async function consumeChallenge(
  flowId: string,
  type: "register" | "login",
): Promise<ChallengeRecord | null> {
  const doc = await AuthChallengeModel.findOneAndDelete({
    flowId,
    type,
    expiresAt: { $gt: new Date() },
  }).lean();
  return doc ? { challenge: doc.challenge, userId: doc.userId ? String(doc.userId) : null } : null;
}

// ---- passkeys ----

const toPasskey = (d: any): PasskeyRecord => ({
  id: String(d._id),
  userId: String(d.userId),
  credentialId: d.credentialId,
  publicKey: d.publicKey,
  counter: d.counter,
  transports: d.transports ?? [],
  deviceType: d.deviceType,
  backedUp: d.backedUp,
  name: d.name,
  createdAt: d.createdAt,
  lastUsedAt: d.lastUsedAt ?? null,
  revokedAt: d.revokedAt ?? null,
});

export async function listActivePasskeys(userId: string): Promise<PasskeyRecord[]> {
  const docs = await PasskeyModel.find({ userId, revokedAt: null }).sort({ createdAt: 1 }).lean();
  return docs.map(toPasskey);
}

export async function findPasskeyByCredentialId(credentialId: string): Promise<PasskeyRecord | null> {
  const doc = await PasskeyModel.findOne({ credentialId }).lean();
  return doc ? toPasskey(doc) : null;
}

export async function createPasskey(
  input: Omit<PasskeyRecord, "id" | "createdAt" | "lastUsedAt" | "revokedAt">,
): Promise<PasskeyRecord> {
  const doc = await PasskeyModel.create(input);
  return toPasskey(doc.toObject());
}

export const touchPasskey = (id: string, oldCounter: number, counter: number) =>
  PasskeyModel.updateOne({ _id: id, revokedAt: null, counter: oldCounter }, { $set: { counter, lastUsedAt: new Date() } });

export async function revokePasskey(userId: string, id: string): Promise<boolean> {
  if (!validId(id)) return false;
  const doc = await PasskeyModel.findOneAndUpdate(
    { _id: id, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).lean();
  return doc !== null;
}

export async function isActiveSession(id: string, userId: string): Promise<boolean> {
  if (!validId(id) || !validId(userId)) return false;
  return (await RefreshTokenModel.exists({ _id: id, userId, revokedAt: null, expiresAt: { $gt: new Date() } })) !== null;
}
