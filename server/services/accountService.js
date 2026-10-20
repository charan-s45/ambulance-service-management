import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Driver } from "../models/Driver.js";
import { config } from "../config/env.js";
import { AppError, conflict } from "../utils/AppError.js";

const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

async function assertEmailFree(email) {
  if (await User.exists({ email })) throw conflict("User with this email already exists. Please login.");
}

export async function createUserAccount({ email, password, name, phone, role = "user" }) {
  await assertEmailFree(email);
  return User.create({
    email,
    // Same default as the prototype: name = part of the email before "@".
    name: name || email.split("@")[0],
    phone: phone || "",
    role,
    passwordHash: await hashPassword(password),
  });
}

// A driver is a login (User with role "driver") plus a Driver profile.
export async function createDriverAccount({ email, password, name, phone, licenseNumber }) {
  const user = await createUserAccount({ email, password, name, phone, role: "driver" });
  try {
    const driver = await Driver.create({ user: user._id, licenseNumber: licenseNumber || "" });
    return { user, driver };
  } catch (err) {
    // Do not leave a driver login without a driver profile.
    await User.deleteOne({ _id: user._id });
    throw err;
  }
}

// Admin self-registration only works when ADMIN_REGISTRATION_CODE is set on the
// server and the person types the same code. Compared in constant time.
export function assertAdminCode(code) {
  const expected = config.adminRegistrationCode;
  if (!expected) {
    throw new AppError(403, "Admin registration is disabled on this server.", "ADMIN_REGISTRATION_DISABLED");
  }
  const a = crypto.createHash("sha256").update(String(code ?? "")).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    throw new AppError(403, "Invalid admin registration code.", "INVALID_ADMIN_CODE");
  }
}
