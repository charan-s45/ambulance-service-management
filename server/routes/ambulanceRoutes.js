import { Router } from "express";
import * as ambulances from "../controllers/ambulanceController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createAmbulanceSchema, updateAmbulanceSchema } from "../validators/schemas.js";

const r = Router();
r.use(requireAuth, requireRole("admin"));

r.get("/", ambulances.list);
r.post("/", validateBody(createAmbulanceSchema), ambulances.create);
r.patch("/:id", validateBody(updateAmbulanceSchema), ambulances.update);
r.delete("/:id", ambulances.remove);

export default r;
