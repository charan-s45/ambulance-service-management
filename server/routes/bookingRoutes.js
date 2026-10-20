import { Router } from "express";
import * as bookings from "../controllers/bookingController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  assignSchema,
  createBookingSchema,
  etaUpdateSchema,
  statusUpdateSchema,
} from "../validators/schemas.js";

const r = Router();
r.use(requireAuth);

r.post("/", requireRole("user"), validateBody(createBookingSchema), bookings.create);
r.get("/my", requireRole("user"), bookings.listMine);
r.get("/assigned", requireRole("driver"), bookings.listAssigned);
r.get("/", requireRole("admin"), bookings.listAll);
r.get("/:id", bookings.getOne);
r.post("/:id/assign", requireRole("admin"), validateBody(assignSchema), bookings.assign);
r.patch("/:id/status", requireRole("admin", "driver"), validateBody(statusUpdateSchema), bookings.updateStatus);
r.patch("/:id/eta", requireRole("admin", "driver"), validateBody(etaUpdateSchema), bookings.updateEta);

export default r;
