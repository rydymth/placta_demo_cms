import { Router } from "express";
import * as ctrl from "../controllers/public.controller.ts";

const router = Router();

router.get("/pages", ctrl.getPage);
router.get("/navigation", ctrl.navigation);
router.get("/site", ctrl.site);

export default router;
