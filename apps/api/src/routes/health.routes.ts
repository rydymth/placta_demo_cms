import { Router } from "express";
import { getHealth } from "../controllers/health.Controllers.ts";

const router = Router();

router.get("/health", getHealth);

export default router; // exposes this as health routes
