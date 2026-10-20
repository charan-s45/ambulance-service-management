import { Ambulance } from "../models/Ambulance.js";
import { badRequest, conflict, notFound } from "../utils/AppError.js";
import { isObjectId } from "../utils/ids.js";

function idParam(req) {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid ambulance ID.");
  return req.params.id;
}

// GET /api/ambulances (admin)
export async function list(_req, res) {
  const ambulances = await Ambulance.find()
    .sort({ code: 1 })
    .populate("currentBooking", "bookingId status");
  res.json({ data: ambulances });
}

// POST /api/ambulances (admin)
export async function create(req, res) {
  if (await Ambulance.exists({ code: req.body.code })) {
    throw conflict(`An ambulance with ID ${req.body.code} already exists.`);
  }
  const ambulance = await Ambulance.create(req.body);
  res.status(201).json({ data: ambulance, message: `Ambulance ${ambulance.code} added.` });
}

// PATCH /api/ambulances/:id (admin)
export async function update(req, res) {
  const id = idParam(req);
  const filter = { _id: id };
  // Changing status by hand is only allowed when the ambulance is not on a job.
  if (req.body.status) filter.status = { $ne: "assigned" };

  const ambulance = await Ambulance.findOneAndUpdate(filter, { $set: req.body }, { returnDocument: "after" });
  if (!ambulance) {
    if (!(await Ambulance.exists({ _id: id }))) throw notFound("Ambulance not found.");
    throw conflict("This ambulance is assigned to an active booking. Complete or re-assign that booking first.");
  }
  res.json({ data: ambulance, message: `Ambulance ${ambulance.code} updated.` });
}

// DELETE /api/ambulances/:id (admin) — refuses while assigned to a booking.
export async function remove(req, res) {
  const id = idParam(req);
  const deleted = await Ambulance.findOneAndDelete({ _id: id, status: { $ne: "assigned" } });
  if (!deleted) {
    if (!(await Ambulance.exists({ _id: id }))) throw notFound("Ambulance not found.");
    throw conflict("This ambulance is assigned to an active booking and cannot be deleted.");
  }
  res.json({ data: null, message: `Ambulance ${deleted.code} deleted.` });
}
