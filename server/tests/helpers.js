// Test helpers: an in-memory MongoDB (a real mongod process in a temp folder,
// never your real database) and "browser" agents that keep their own cookies.

import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { hashPassword } from "../controllers/authController.js";

let mongod;

export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.connection.syncIndexes();
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function makeApp(options) {
  return createApp(options);
}

// A separate agent = a separate browser with its own cookie jar.
export function browser(app) {
  return request.agent(app).set("X-Requested-With", "XMLHttpRequest");
}

// Admins can only be created outside the public API, so tests insert directly.
export async function createAdmin(email = "admin@test.com", password = "AdminPass123") {
  await User.create({ email, name: "Admin", role: "admin", passwordHash: await hashPassword(password) });
  return { email, password };
}

export async function loggedIn(app, email, password) {
  const b = browser(app);
  const res = await b.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return b;
}

export async function registerUser(app, email = "user@test.com", password = "UserPass123") {
  const b = browser(app);
  const res = await b.post("/api/auth/register").send({ email, password });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  await b.post("/api/auth/login").send({ email, password });
  return b;
}

export function inMinutes(m) {
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}

export const validBooking = () => ({
  pickup: "12 Main St.",
  destination: "City General Hospital",
  scheduledFor: inMinutes(10),
});

// Builds a typical world: admin, one user, one driver, two ambulances.
export async function world(app) {
  const adminCreds = await createAdmin();
  const admin = await loggedIn(app, adminCreds.email, adminCreds.password);
  const user = await registerUser(app);

  const drv = await admin.post("/api/drivers").send({
    name: "Ramesh",
    email: "driver@test.com",
    password: "DriverPass123",
    phone: "+91 98765 43210",
  });
  const driver = await loggedIn(app, "driver@test.com", "DriverPass123");

  const a1 = await admin.post("/api/ambulances").send({ code: "A101", vehicle: "Ambulance A101" });
  const a2 = await admin.post("/api/ambulances").send({ code: "A102", vehicle: "Ambulance A102" });

  return {
    admin,
    user,
    driver,
    driverId: drv.body.data.id,
    ambulanceIds: [a1.body.data._id, a2.body.data._id],
  };
}
