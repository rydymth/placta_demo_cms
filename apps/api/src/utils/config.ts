import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile();

const env = (name: string, fallback?: string): string => {
  const value = process.env[name];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
};

const positiveInteger = (name: string, fallback: number): number => {
  const value = env(name, String(fallback));
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
    throw new Error(`${name} must be a positive integer`);
  return Number(value);
};

const adminOrigin = env("ADMIN_ORIGIN", "http://localhost:4201");
const port = positiveInteger("PORT", 6969);
if (port > 65535) throw new Error("PORT must be between 1 and 65535");

const config = {
  nodeEnv: env("NODE_ENV", "development"),
  isProd: env("NODE_ENV", "development") === "production",
  host: env("API_HOST", "localhost"),
  port,
  mongodbUri: env("MONGODB_URI"),
  adminOrigin,
  publicOrigin: env("PUBLIC_ORIGIN", "http://localhost:4200"),
  trustProxy: env("TRUST_PROXY", "false") === "true",
  rpId: env("WEBAUTHN_RP_ID", new URL(adminOrigin).hostname),
  rpName: env("WEBAUTHN_RP_NAME", "Placta CMS"),
  accessTokenTtlSeconds: positiveInteger("ACCESS_TOKEN_TTL_SECONDS", 900),
  refreshTokenTtlDays: positiveInteger("REFRESH_TOKEN_TTL_DAYS", 14),
  get jwtAccessSecret(): string {
    const secret = env("JWT_ACCESS_SECRET");
    if (secret.length < 32) throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
    return secret;
  },
};

export default config;
