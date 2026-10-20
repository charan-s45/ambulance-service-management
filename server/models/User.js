import mongoose from "mongoose";

export const ROLES = ["user", "driver", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // bcrypt hash only. `select: false` keeps it out of every query unless
    // a query explicitly asks for it with .select("+passwordHash").
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "user", index: true },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model("User", userSchema);
