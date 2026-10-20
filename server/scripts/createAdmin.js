// Creates an administrator account from the command line.
// There is deliberately NO public API endpoint that can create an admin.
//
// Usage (from the server folder):
//   npm run create-admin -- --email admin@yourorg.com --name "Admin Name"
// You will be asked for the password. For automation you may instead set the
// ADMIN_PASSWORD environment variable (never commit it).
//
// Add --promote to turn an EXISTING account into an admin.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { hashPassword } from "../controllers/authController.js";
import { registerSchema } from "../validators/schemas.js";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function askPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const pw = await rl.question("Password for the new admin (min 8 chars): ");
  rl.close();
  return pw;
}

async function main() {
  const email = arg("email");
  const name = arg("name") || "Admin";
  const promote = process.argv.includes("--promote");
  if (!email) throw new Error('Please pass --email, e.g. npm run create-admin -- --email admin@example.com --name "Admin"');

  await connectDB(config.mongoUri);
  const existing = await User.findOne({ email: email.toLowerCase().trim() });

  if (existing) {
    if (!promote) throw new Error("That email is already registered. Re-run with --promote to make it an admin.");
    existing.role = "admin";
    await existing.save();
    console.log(`✔ ${existing.email} is now an admin.`);
    return;
  }

  const parsed = registerSchema.safeParse({ email, password: await askPassword(), name });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await User.create({
    email: parsed.data.email,
    name: parsed.data.name,
    role: "admin",
    passwordHash: await hashPassword(parsed.data.password),
  });
  console.log(`✔ Admin created: ${user.email}`);
}

main()
  .catch((err) => {
    console.error("✖", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
