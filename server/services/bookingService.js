import { Booking } from "../models/Booking.js";
import { Ambulance } from "../models/Ambulance.js";
import { Driver } from "../models/Driver.js";
import { Feedback } from "../models/Feedback.js";
import { config } from "../config/env.js";
import { newBookingId } from "../utils/ids.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../utils/AppError.js";

const AFTER = { returnDocument: "after" };

// The only allowed forward moves. "new → pending" happens through assignment.
export const NEXT_STATUS = { pending: "enroute", enroute: "arrived", arrived: "completed" };

const POPULATE = [
  { path: "user", select: "name email phone" },
  { path: "ambulance", select: "code vehicle registrationNumber" },
  { path: "driver", select: "user licenseNumber", populate: { path: "user", select: "name phone" } },
];

// ---------------------------------------------------------------------------
// Shaping data for the API
// ---------------------------------------------------------------------------

// Turns a populated booking document into the JSON the React app receives.
// `includeUser` is only true for admins/drivers — a user already knows who they are.
export function toBookingView(b, { feedback = null, includeUser = false } = {}) {
  const view = {
    id: b._id.toString(),
    bookingId: b.bookingId,
    pickup: b.pickup,
    destination: b.destination,
    scheduledFor: b.scheduledFor,
    status: b.status,
    eta: {
      minutes: b.eta?.minutes ?? null,
      source: b.eta?.source ?? null,
      updatedAt: b.eta?.updatedAt ?? null,
    },
    ambulance: b.ambulance
      ? {
          id: b.ambulance._id.toString(),
          code: b.ambulance.code,
          vehicle: b.ambulance.vehicle,
          registrationNumber: b.ambulance.registrationNumber,
        }
      : null,
    driver: b.driver
      ? {
          id: b.driver._id.toString(),
          name: b.driver.user?.name ?? "Removed driver",
          phone: b.driver.user?.phone ?? "",
        }
      : null,
    statusHistory: (b.statusHistory || []).map((h) => ({ status: h.status, at: h.at })),
    feedback: feedback ? { rating: feedback.rating, comments: feedback.comments } : null,
    completedAt: b.completedAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
  if (includeUser) {
    view.user = b.user
      ? { id: b.user._id.toString(), name: b.user.name, email: b.user.email, phone: b.user.phone }
      : null;
  }
  return view;
}

async function feedbackByBooking(bookingIds) {
  const list = await Feedback.find({ booking: { $in: bookingIds } }).lean();
  return new Map(list.map((f) => [f.booking.toString(), f]));
}

async function toViews(bookings, opts = {}) {
  const fb = await feedbackByBooking(bookings.map((b) => b._id));
  return bookings.map((b) => toBookingView(b, { ...opts, feedback: fb.get(b._id.toString()) }));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAllBookings({ status } = {}) {
  const filter = status ? { status } : {};
  const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(500).populate(POPULATE);
  return toViews(bookings, { includeUser: true });
}

export async function listUserBookings(userId) {
  const bookings = await Booking.find({ user: userId }).sort({ createdAt: -1 }).populate(POPULATE);
  return toViews(bookings);
}

export async function listDriverBookings(userId) {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) return [];
  const bookings = await Booking.find({ driver: driver._id }).sort({ createdAt: -1 }).populate(POPULATE);
  return toViews(bookings, { includeUser: true });
}

// Returns a booking only if `actor` is allowed to see it. Others get 404 so
// they cannot even learn that the booking exists.
export async function getBookingForActor(id, actor) {
  const booking = await Booking.findById(id).populate(POPULATE);
  if (!booking) throw notFound("Booking not found.");

  if (actor.role === "admin") return (await toViews([booking], { includeUser: true }))[0];
  if (actor.role === "user" && booking.user?._id.equals(actor._id)) {
    return (await toViews([booking]))[0];
  }
  if (actor.role === "driver") {
    const driver = await Driver.findOne({ user: actor._id });
    if (driver && booking.driver?._id.equals(driver._id)) {
      return (await toViews([booking], { includeUser: true }))[0];
    }
  }
  throw notFound("Booking not found.");
}

async function viewById(id, opts) {
  const booking = await Booking.findById(id).populate(POPULATE);
  return (await toViews([booking], opts))[0];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function createBooking(user, { pickup, destination, scheduledFor }) {
  const when = new Date(scheduledFor);
  const now = Date.now();
  if (when.getTime() < now - 60 * 60 * 1000) {
    throw badRequest("The pickup date and time cannot be in the past.");
  }
  if (when.getTime() > now + 365 * 24 * 60 * 60 * 1000) {
    throw badRequest("Bookings can be made at most one year in advance.");
  }

  // A clearly-labelled configurable estimate, NOT a GPS/route prediction.
  const eta = { minutes: config.defaultEtaMinutes, source: "default_estimate", updatedAt: new Date() };

  // Retry if the random booking ID happens to already exist (unique index).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const booking = await Booking.create({
        bookingId: newBookingId(),
        user: user._id,
        pickup,
        destination,
        scheduledFor: when,
        status: "new",
        eta,
        statusHistory: [{ status: "new", by: user._id }],
      });
      return viewById(booking._id);
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.bookingId) continue;
      throw err;
    }
  }
  throw new AppError(503, "Could not create a booking ID. Please try again.", "ID_EXHAUSTED");
}

// Admins can operate any booking; drivers only the bookings assigned to them.
async function assertCanOperate(booking, actor) {
  if (actor.role === "admin") return "dispatcher";
  if (actor.role === "driver") {
    const driver = await Driver.findOne({ user: actor._id });
    if (driver && booking.driver && booking.driver.equals(driver._id)) return "driver";
    throw forbidden("You are not assigned to this booking.");
  }
  throw forbidden();
}

// Releases a resource only if it is still held by this booking, so we never
// free an ambulance/driver that has since been given to another booking.
function releaseAmbulance(ambulanceId, bookingId) {
  return Ambulance.updateOne(
    { _id: ambulanceId, currentBooking: bookingId },
    { $set: { status: "available", currentBooking: null } },
  );
}
function releaseDriver(driverId, bookingId) {
  return Driver.updateOne(
    { _id: driverId, currentBooking: bookingId },
    { $set: { status: "available", currentBooking: null } },
  );
}

/**
 * Assign (or re-assign) an ambulance AND a driver to a booking.
 *
 * Concurrency strategy — conditional atomic updates, no transactions needed:
 * 1. "Claim" the ambulance with ONE findOneAndUpdate whose filter requires
 *    status "available". MongoDB applies a single-document update atomically,
 *    so if two admins race for the same ambulance only one update matches;
 *    the other gets `null` and receives a 409 Conflict.
 * 2. Claim the driver the same way.
 * 3. Update the booking with a filter that checks it has not changed since
 *    we read it (optimistic concurrency).
 * If any step fails, the claims already made are rolled back (released), so a
 * failed assignment never leaves a resource marked as busy.
 */
export async function assignResources(bookingId, { ambulanceId, driverId }, actor) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound("Booking not found.");
  if (!["new", "pending"].includes(booking.status)) {
    throw conflict("Only new or pending bookings can be assigned an ambulance and driver.");
  }

  const oldAmbulance = booking.ambulance?.toString() ?? null;
  const oldDriver = booking.driver?.toString() ?? null;
  const undo = [];

  try {
    if (ambulanceId !== oldAmbulance) {
      const claimed = await Ambulance.findOneAndUpdate(
        { _id: ambulanceId, status: "available" },
        { $set: { status: "assigned", currentBooking: booking._id } },
        AFTER,
      );
      if (!claimed) {
        const amb = await Ambulance.findById(ambulanceId);
        if (!amb) throw notFound("Ambulance not found.");
        throw conflict(`Ambulance ${amb.code} is not available (status: ${amb.status}).`);
      }
      undo.push(() => releaseAmbulance(ambulanceId, booking._id));
    }

    if (driverId !== oldDriver) {
      const claimed = await Driver.findOneAndUpdate(
        { _id: driverId, status: "available" },
        { $set: { status: "assigned", currentBooking: booking._id } },
        AFTER,
      ).populate("user", "name");
      if (!claimed) {
        const drv = await Driver.findById(driverId).populate("user", "name");
        if (!drv) throw notFound("Driver not found.");
        throw conflict(`Driver ${drv.user?.name ?? drv._id} is not available (status: ${drv.status}).`);
      }
      undo.push(() => releaseDriver(driverId, booking._id));
    }

    const update = {
      $set: { ambulance: ambulanceId, driver: driverId, status: "pending" },
    };
    if (booking.status === "new") {
      update.$push = { statusHistory: { status: "pending", by: actor._id } };
    }
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status, ambulance: booking.ambulance, driver: booking.driver },
      update,
      AFTER,
    );
    if (!updated) {
      throw conflict("This booking was changed by someone else. Please refresh and try again.");
    }
  } catch (err) {
    for (const fn of undo.reverse()) await fn();
    throw err;
  }

  // Re-assignment: free the previous ambulance/driver.
  if (oldAmbulance && oldAmbulance !== ambulanceId) await releaseAmbulance(oldAmbulance, booking._id);
  if (oldDriver && oldDriver !== driverId) await releaseDriver(oldDriver, booking._id);

  return viewById(booking._id, { includeUser: true });
}

export async function changeStatus(bookingId, { status, etaMinutes }, actor) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound("Booking not found.");
  const etaSource = await assertCanOperate(booking, actor);

  if (booking.status === "new") {
    throw conflict("Assign an ambulance and a driver before updating the status.");
  }
  if (NEXT_STATUS[booking.status] !== status) {
    throw conflict(`Cannot change status from "${booking.status}" to "${status}".`);
  }
  if (status === "enroute" && !etaMinutes) {
    throw badRequest('Please set a valid Estimated Time of Arrival (ETA) in minutes before setting status to "En route".');
  }

  const $set = { status };
  if (status === "enroute") {
    $set.eta = { minutes: etaMinutes, source: etaSource, updatedAt: new Date() };
  } else {
    // Once the ambulance has arrived an arrival estimate no longer makes sense.
    $set.eta = { minutes: null, source: null, updatedAt: null };
  }
  if (status === "completed") $set.completedAt = new Date();

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set, $push: { statusHistory: { status, by: actor._id } } },
    AFTER,
  );
  if (!updated) throw conflict("This booking was changed by someone else. Please refresh and try again.");

  if (status === "completed") {
    if (updated.ambulance) await releaseAmbulance(updated.ambulance, updated._id);
    if (updated.driver) await releaseDriver(updated.driver, updated._id);
  }

  return viewById(updated._id, { includeUser: true });
}

export async function updateEta(bookingId, { etaMinutes }, actor) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound("Booking not found.");
  const etaSource = await assertCanOperate(booking, actor);
  if (!["pending", "enroute"].includes(booking.status)) {
    throw conflict("ETA can only be updated while the booking is pending or en route.");
  }
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["pending", "enroute"] } },
    { $set: { eta: { minutes: etaMinutes, source: etaSource, updatedAt: new Date() } } },
    AFTER,
  );
  if (!updated) throw conflict("This booking was changed by someone else. Please refresh and try again.");
  return viewById(updated._id, { includeUser: true });
}
