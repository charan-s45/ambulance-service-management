import { Driver } from "../models/Driver.js";
import { User } from "../models/User.js";
import { createDriverAccount } from "../services/accountService.js";
import { badRequest, conflict, notFound } from "../utils/AppError.js";
import { isObjectId } from "../utils/ids.js";

function idParam(req) {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid driver ID.");
  return req.params.id;
}

function driverView(d) {
  return {
    id: d._id.toString(),
    userId: d.user?._id?.toString() ?? null,
    name: d.user?.name ?? "",
    email: d.user?.email ?? "",
    phone: d.user?.phone ?? "",
    licenseNumber: d.licenseNumber,
    status: d.status,
    currentBooking: d.currentBooking
      ? { id: d.currentBooking._id.toString(), bookingId: d.currentBooking.bookingId, status: d.currentBooking.status }
      : null,
    createdAt: d.createdAt,
  };
}

async function loadView(id) {
  const d = await Driver.findById(id)
    .populate("user", "name email phone")
    .populate("currentBooking", "bookingId status");
  return driverView(d);
}

// GET /api/drivers (admin)
export async function list(_req, res) {
  const drivers = await Driver.find()
    .populate("user", "name email phone")
    .populate("currentBooking", "bookingId status")
    .sort({ createdAt: 1 });
  res.json({ data: drivers.map(driverView) });
}

// POST /api/drivers (admin) — creates the driver's login account AND profile.
export async function create(req, res) {
  const { driver } = await createDriverAccount(req.body);
  res.status(201).json({ data: await loadView(driver._id), message: `Driver ${req.body.name} added.` });
}

// PATCH /api/drivers/:id (admin)
export async function update(req, res) {
  const id = idParam(req);
  const { name, phone, licenseNumber, status } = req.body;

  const driver = await Driver.findById(id);
  if (!driver) throw notFound("Driver not found.");

  const driverSet = {};
  if (licenseNumber !== undefined) driverSet.licenseNumber = licenseNumber;
  if (status !== undefined) driverSet.status = status;

  if (Object.keys(driverSet).length) {
    const filter = { _id: id };
    // Cannot mark a driver available/off duty while they are on a job.
    if (status !== undefined) filter.status = { $ne: "assigned" };
    const updated = await Driver.findOneAndUpdate(filter, { $set: driverSet });
    if (!updated) {
      throw conflict("This driver is assigned to an active booking. Complete or re-assign that booking first.");
    }
  }

  const userSet = {};
  if (name !== undefined) userSet.name = name;
  if (phone !== undefined) userSet.phone = phone;
  if (Object.keys(userSet).length) await User.updateOne({ _id: driver.user }, { $set: userSet });

  res.json({ data: await loadView(id), message: "Driver updated." });
}

// DELETE /api/drivers/:id (admin) — removes the profile and the driver's login.
// Past bookings keep their reference and display "Removed driver".
export async function remove(req, res) {
  const id = idParam(req);
  const deleted = await Driver.findOneAndDelete({ _id: id, status: { $ne: "assigned" } });
  if (!deleted) {
    if (!(await Driver.exists({ _id: id }))) throw notFound("Driver not found.");
    throw conflict("This driver is assigned to an active booking and cannot be deleted.");
  }
  await User.deleteOne({ _id: deleted.user, role: "driver" });
  res.json({ data: null, message: "Driver deleted." });
}
