import mongoose from "mongoose";

// A Driver is the operational profile of a User whose role is "driver".
// Login details (name, email, password) live on the User; availability and
// the current assignment live here. One user ⇢ at most one driver profile.
export const DRIVER_STATUSES = ["available", "assigned", "off_duty"];

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    licenseNumber: { type: String, trim: true, maxlength: 40, default: "" },
    status: { type: String, enum: DRIVER_STATUSES, default: "available", index: true },
    currentBooking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true },
);

driverSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Driver = mongoose.model("Driver", driverSchema);
