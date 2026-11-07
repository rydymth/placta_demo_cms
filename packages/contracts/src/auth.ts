import { z } from "zod";

export const emailSchema = z.email().max(254);

// Only enforced when a password is *set*; login accepts any non-empty string.
export const newPasswordSchema = z.string().min(12).max(128);

const passwordInput = z.string().min(1).max(128);

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordInput,
});

export const registerRequestSchema = z.strictObject({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: newPasswordSchema,
});

export const reauthRequestSchema = z.strictObject({ password: passwordInput });

const flowId = z.string().min(1).max(128);
// The WebAuthn payload is validated by @simplewebauthn/server, so only check it is an object here.
const webauthnResponse = z.looseObject({});

export const passkeyRegisterVerifySchema = z.strictObject({
  flowId,
  response: webauthnResponse,
  name: z.string().trim().min(1).max(60).optional(),
});

export const passkeyAuthVerifySchema = z.strictObject({
  flowId,
  response: webauthnResponse,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
