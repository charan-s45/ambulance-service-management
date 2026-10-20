import mongoose from "mongoose";

// "assigned" replaces the prototype's "pending" ambulance status.
export const AMBULANCE_STATUSES = ["available", "assigned", "maintenance"];

const ambulanceSchema = new mongoose.Schema(
  {
    // Short fleet code shown everywhere in the UI, e.g. "A101".
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    vehicle: { type: String, required: true, trim: true, maxlength: 100 },
    registrationNumber: { type: String, trim: true, maxlength: 30, default: "" },
    status: { type: String, enum: AMBULANCE_STATUSES, default: "available", index: true },
    currentBooking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true },
);

ambulanceSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Ambulance = mongoose.model("Ambulance", ambulanceSchema);
