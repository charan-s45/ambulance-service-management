import * as bookings from "../services/bookingService.js";
import { BOOKING_STATUSES } from "../models/Booking.js";
import { badRequest } from "../utils/AppError.js";
import { isObjectId } from "../utils/ids.js";

function idParam(req) {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid booking ID.");
  return req.params.id;
}

// POST /api/bookings (user)
export async function create(req, res) {
  const booking = await bookings.createBooking(req.user, req.body);
  res.status(201).json({ data: booking, message: "Booking Confirmed!" });
}

// GET /api/bookings/my (user)
export async function listMine(req, res) {
  res.json({ data: await bookings.listUserBookings(req.user._id) });
}

// GET /api/bookings/assigned (driver)
export async function listAssigned(req, res) {
  res.json({ data: await bookings.listDriverBookings(req.user._id) });
}

// GET /api/bookings?status=new (admin)
export async function listAll(req, res) {
  const { status } = req.query;
  if (status !== undefined && !BOOKING_STATUSES.includes(status)) {
    throw badRequest(`status must be one of: ${BOOKING_STATUSES.join(", ")}`);
  }
  res.json({ data: await bookings.listAllBookings({ status }) });
}

// GET /api/bookings/:id (owner, admin, or assigned driver)
export async function getOne(req, res) {
  res.json({ data: await bookings.getBookingForActor(idParam(req), req.user) });
}

// POST /api/bookings/:id/assign (admin)
export async function assign(req, res) {
  const booking = await bookings.assignResources(idParam(req), req.body, req.user);
  res.json({
    data: booking,
    message: `Assigned ambulance ${booking.ambulance.code} and driver ${booking.driver.name}.`,
  });
}

// PATCH /api/bookings/:id/status (admin or assigned driver)
export async function updateStatus(req, res) {
  const booking = await bookings.changeStatus(idParam(req), req.body, req.user);
  res.json({ data: booking, message: `Status updated to ${booking.status}.` });
}

// PATCH /api/bookings/:id/eta (admin or assigned driver)
export async function updateEta(req, res) {
  const booking = await bookings.updateEta(idParam(req), req.body, req.user);
  res.json({ data: booking, message: `ETA updated to ${booking.eta.minutes} mins.` });
}
