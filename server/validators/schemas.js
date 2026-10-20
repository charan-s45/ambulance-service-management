import { z } from "zod";
import { isObjectId } from "../utils/ids.js";

const text = (label, max) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const email = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Please enter a valid email address.").max(254));

const newPassword = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters."); // bcrypt limit

const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9+\-() ]*$/, "Phone number may only contain digits, spaces, +, -, ( and ).");

const objectId = (label) =>
  z.string({ error: `${label} is required.` }).refine(isObjectId, `${label} is not a valid ID.`);

const etaMinutes = z
  .number({ error: "ETA must be a number of minutes." })
  .int("ETA must be a whole number of minutes.")
  .min(1, "ETA must be at least 1 minute.")
  .max(600, "ETA must be at most 600 minutes.");

// ---------- Auth ----------
// Registration as user or driver is open; admin needs the secret admin code
// (checked in accountService). Drivers must give their name.
export const registerSchema = z
  .object({
    role: z.enum(["user", "driver", "admin"], { error: "Account type must be user, driver or admin." }).default("user"),
    email,
    password: newPassword,
    name: text("Name", 80).optional(),
    phone: phone.optional(),
    licenseNumber: z.string().trim().max(40).optional(),
    adminCode: z.string().max(200).optional(),
  })
  .strict()
  .refine((v) => v.role !== "driver" || v.name, { message: "Name is required for drivers.", path: ["name"] })
  .refine((v) => v.role === "driver" || v.licenseNumber === undefined, {
    message: "License number is only for driver accounts.",
    path: ["licenseNumber"],
  })
  .refine((v) => v.role === "admin" || v.adminCode === undefined, {
    message: "Admin code is only for admin accounts.",
    path: ["adminCode"],
  });

export const loginSchema = z
  .object({
    email,
    password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(200),
    // Which login the person chose (User / Driver / Admin). It never grants a
    // role — the server only checks that it matches the account's real role.
    role: z.enum(["user", "driver", "admin"], { error: "Login type must be user, driver or admin." }).optional(),
  })
  .strict();

// ---------- Bookings ----------
export const createBookingSchema = z
  .object({
    pickup: text("Pickup location", 200),
    destination: text("Destination", 200),
    // ISO date-time built by the client from the date + time inputs.
    scheduledFor: z.iso.datetime({ offset: true, error: "Please choose a valid date and time." }),
  })
  .strict();

export const statusUpdateSchema = z
  .object({
    status: z.enum(["enroute", "arrived", "completed"], {
      error: "Status must be one of: enroute, arrived, completed.",
    }),
    etaMinutes: etaMinutes.optional(),
  })
  .strict();

export const etaUpdateSchema = z.object({ etaMinutes }).strict();

export const assignSchema = z
  .object({
    ambulanceId: objectId("Ambulance"),
    driverId: objectId("Driver"),
  })
  .strict();

// ---------- Ambulances ----------
export const createAmbulanceSchema = z
  .object({
    code: z
      .string({ error: "Ambulance ID is required." })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,20}$/, "Ambulance ID may only use letters, digits and '-' (max 20)."),
    vehicle: text("Vehicle description", 100),
    registrationNumber: z.string().trim().max(30).optional(),
  })
  .strict();

export const updateAmbulanceSchema = z
  .object({
    vehicle: text("Vehicle description", 100).optional(),
    registrationNumber: z.string().trim().max(30).optional(),
    // "assigned" can only be set by the assignment workflow, not by hand.
    status: z.enum(["available", "maintenance"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

// ---------- Drivers ----------
export const createDriverSchema = z
  .object({
    name: text("Name", 80),
    email,
    password: newPassword,
    phone: phone.optional(),
    licenseNumber: z.string().trim().max(40).optional(),
  })
  .strict();

export const updateDriverSchema = z
  .object({
    name: text("Name", 80).optional(),
    phone: phone.optional(),
    licenseNumber: z.string().trim().max(40).optional(),
    status: z.enum(["available", "off_duty"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

// ---------- Feedback ----------
export const feedbackSchema = z
  .object({
    bookingId: objectId("Booking"),
    rating: z
      .number({ error: "Please select an overall rating." })
      .int()
      .min(1, "Rating must be between 1 and 5.")
      .max(5, "Rating must be between 1 and 5."),
    comments: z.string().trim().max(1000, "Comments must be at most 1000 characters.").optional(),
  })
  .strict();
