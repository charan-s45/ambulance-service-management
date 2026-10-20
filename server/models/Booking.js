import mongoose from "mongoose";

// Same status names as the original prototype:
// new → pending (ambulance + driver assigned) → enroute → arrived → completed
export const BOOKING_STATUSES = ["new", "pending", "enroute", "arrived", "completed"];
export const ACTIVE_STATUSES = ["new", "pending", "enroute", "arrived"];

// Where the ETA number came from. Nothing here is GPS-based.
export const ETA_SOURCES = ["default_estimate", "dispatcher", "driver"];

const statusChangeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    // Human-friendly ID like the prototype's "REQ123456". Generated on the server.
    bookingId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pickup: { type: String, required: true, trim: true, maxlength: 200 },
    destination: { type: String, required: true, trim: true, maxlength: 200 },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "new", index: true },
    ambulance: { type: mongoose.Schema.Types.ObjectId, ref: "Ambulance", default: null },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
    eta: {
      minutes: { type: Number, min: 1, max: 600, default: null },
      source: { type: String, enum: ETA_SOURCES, default: null },
      updatedAt: { type: Date, default: null },
    },
    statusHistory: { type: [statusChangeSchema], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ driver: 1, status: 1 });

bookingSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Booking = mongoose.model("Booking", bookingSchema);
