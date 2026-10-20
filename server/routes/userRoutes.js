import { Router } from "express";
import * as users from "../controllers/userController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.get("/", requireAuth, requireRole("admin"), users.list);

export default r;
