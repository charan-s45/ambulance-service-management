import { Router } from "express";
import * as stats from "../controllers/statsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.get("/public", stats.publicStats);
r.get("/admin", requireAuth, requireRole("admin"), stats.adminStats);

export default r;
