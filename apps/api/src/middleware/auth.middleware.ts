import type { RequestHandler, Response } from "express";
import type { UserDto } from "@placta/contracts";
import { verifyAccessToken } from "../services/token.service.ts";
import { toUserDto } from "../services/auth.service.ts";
import { findUserById, isActiveSession } from "../repositories/auth.repository.ts";
import { forbidden, unauthorized } from "../utils/errors.ts";

export const getAuth = (res: Response): UserDto => res.locals["auth"] as UserDto;

export const authenticate: RequestHandler = async (req, res, next) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!token) throw unauthorized();
  const claims = await verifyAccessToken(token).catch(() => { throw unauthorized("Invalid or expired token"); });
  const user = await findUserById(claims.userId);
  if (!user || !(await isActiveSession(claims.sessionId, claims.userId))) throw unauthorized("Invalid or expired session");
  res.locals["auth"] = toUserDto(user);
  next();
};

export const requireRole = (...roles: UserDto["role"][]): RequestHandler => (_req, res, next) => {
  if (!roles.includes(getAuth(res).role)) throw forbidden();
  next();
};
