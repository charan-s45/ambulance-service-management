import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    // unique: a booking can receive feedback only once (same rule as the prototype).
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true },
);

feedbackSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Feedback = mongoose.model("Feedback", feedbackSchema);
