// DEVELOPMENT ONLY: adds the same sample ambulances as the old prototype
// (A101, A102, A103 in maintenance) plus a demo driver and demo user, so you can
// try the app quickly. Passwords are random and printed once — nothing is
// hard-coded. Existing records are never overwritten.
//
// Usage: npm run seed

import crypto from "node:crypto";
import { config } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { Ambulance } from "../models/Ambulance.js";
import { Driver } from "../models/Driver.js";
import { User } from "../models/User.js";
import { hashPassword } from "../controllers/authController.js";

const AMBULANCES = [
  { code: "A101", vehicle: "Ambulance A101", status: "available" },
  { code: "A102", vehicle: "Ambulance A102", status: "available" },
  { code: "A103", vehicle: "Ambulance A103", status: "maintenance" },
];

async function ensureUser({ email, name, role }) {
  if (await User.exists({ email })) {
    console.log(`  - ${email} already exists, skipped`);
    return null;
  }
  const password = crypto.randomBytes(9).toString("base64url");
  const user = await User.create({ email, name, role, passwordHash: await hashPassword(password) });
  console.log(`  + ${role.padEnd(6)} ${email}  password: ${password}`);
  return user;
}

async function main() {
  if (config.isProduction) throw new Error("Refusing to seed demo data in production.");
  await connectDB(config.mongoUri);

  console.log("Ambulances:");
  for (const a of AMBULANCES) {
    if (await Ambulance.exists({ code: a.code })) console.log(`  - ${a.code} already exists, skipped`);
    else {
      await Ambulance.create(a);
      console.log(`  + ${a.code} (${a.status})`);
    }
  }

  console.log("Demo accounts (save these passwords now, they are not stored anywhere):");
  const driverUser = await ensureUser({ email: "driver@example.com", name: "Ramesh", role: "driver" });
  if (driverUser) await Driver.create({ user: driverUser._id });
  await ensureUser({ email: "user@example.com", name: "Kavya", role: "user" });

  console.log("\nCreate your admin with: npm run create-admin -- --email you@example.com");
}

main()
  .catch((err) => {
    console.error("✖", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
