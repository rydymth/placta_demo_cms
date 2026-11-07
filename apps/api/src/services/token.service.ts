import { SignJWT, jwtVerify } from "jose";
import config from "../utils/config.ts";

const ISSUER = "placta";
const AUDIENCE = "placta-admin";
const key = () => new TextEncoder().encode(config.jwtAccessSecret);

export const signAccessToken = (userId: string, sessionId: string): Promise<string> =>
  new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + config.accessTokenTtlSeconds)
    .sign(key());

export async function verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
  const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
  if (!payload.sub || typeof payload.sid !== "string") throw new Error("Invalid token claims");
  return { userId: payload.sub, sessionId: payload.sid };
}
