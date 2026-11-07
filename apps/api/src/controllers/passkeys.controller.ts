import type { Request, Response } from "express";
import type { PasskeyDto } from "@placta/contracts";
import { passkeyRegisterVerifySchema, reauthRequestSchema } from "@placta/contracts";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import * as authService from "../services/auth.service.ts";
import * as passkeyService from "../services/passkey.service.ts";
import * as repo from "../repositories/auth.repository.ts";
import type { PasskeyRecord } from "../repositories/auth.repository.ts";
import { getAuth } from "../middleware/auth.middleware.ts";
import { requestContext } from "./auth.controller.ts";
import { ok } from "../utils/http.ts";

const toDto = (p: PasskeyRecord): PasskeyDto => ({
  id: p.id,
  name: p.name,
  createdAt: p.createdAt.toISOString(),
  lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
  deviceType: p.deviceType,
  backedUp: p.backedUp,
});

export async function list(_req: Request, res: Response) {
  res.json(ok((await repo.listActivePasskeys(getAuth(res).id)).map(toDto)));
}

export async function registerOptions(req: Request, res: Response) {
  const user = getAuth(res);
  const { password } = reauthRequestSchema.parse(req.body);
  await authService.assertPassword(user.id, password);
  res.json(ok(await passkeyService.beginRegistration(user)));
}

export async function registerVerify(req: Request, res: Response) {
  const { flowId, response, name } = passkeyRegisterVerifySchema.parse(req.body);
  const passkey = await passkeyService.finishRegistration(
    getAuth(res),
    flowId,
    response as unknown as RegistrationResponseJSON,
    name,
    requestContext(req),
  );
  res.status(201).json(ok(toDto(passkey), "Passkey added"));
}

export async function revoke(req: Request, res: Response) {
  const user = getAuth(res);
  const { password } = reauthRequestSchema.parse(req.body);
  await authService.assertPassword(user.id, password);
  await passkeyService.removePasskey(user, String(req.params["id"]), requestContext(req));
  res.json(ok(null, "Passkey removed"));
}
