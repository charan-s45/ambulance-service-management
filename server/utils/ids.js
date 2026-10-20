import crypto from "node:crypto";
import mongoose from "mongoose";

// Same format as the prototype ("REQ" + 6 digits) but generated on the server
// with a cryptographically secure random source. Uniqueness is guaranteed by the
// unique index on Booking.bookingId; the caller retries on a collision.
export function newBookingId() {
  return "REQ" + crypto.randomInt(100000, 1000000);
}

export function isObjectId(value) {
  return typeof value === "string" && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);
}
