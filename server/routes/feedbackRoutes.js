import { Router } from "express";
import * as feedback from "../controllers/feedbackController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { feedbackSchema } from "../validators/schemas.js";

const r = Router();
r.use(requireAuth);

r.post("/", requireRole("user"), validateBody(feedbackSchema), feedback.create);
r.get("/", requireRole("admin"), feedback.list);

export default r;
