import { Router } from "express";
import * as drivers from "../controllers/driverController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createDriverSchema, updateDriverSchema } from "../validators/schemas.js";

const r = Router();
r.use(requireAuth, requireRole("admin"));

r.get("/", drivers.list);
r.post("/", validateBody(createDriverSchema), drivers.create);
r.patch("/:id", validateBody(updateDriverSchema), drivers.update);
r.delete("/:id", drivers.remove);

export default r;
