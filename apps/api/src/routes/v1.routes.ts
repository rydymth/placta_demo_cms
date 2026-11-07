import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import publicRoutes from "./public.routes.ts";
import adminRoutes from "./admin.routes.ts";
import { authenticate, requireRole } from "../middleware/auth.middleware.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/admin", authenticate, requireRole("admin"), adminRoutes);

export default router;
