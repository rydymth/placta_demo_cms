import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.ts";
import { authenticate } from "../middleware/auth.middleware.ts";
import { requireAdminOrigin } from "../middleware/origin.middleware.ts";
import { rateLimit } from "../middleware/rate-limit.middleware.ts";

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10 });
const passkeyLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

router.post("/login", requireAdminOrigin, loginLimiter, ctrl.login);
router.post("/register", requireAdminOrigin, loginLimiter, ctrl.register);
router.post("/refresh", requireAdminOrigin, ctrl.refresh);
router.post("/logout", requireAdminOrigin, ctrl.logout);
router.get("/me", authenticate, ctrl.me);
router.post("/passkey/options", requireAdminOrigin, passkeyLimiter, ctrl.passkeyOptions);
router.post("/passkey/verify", requireAdminOrigin, passkeyLimiter, ctrl.passkeyVerify);

export default router;
