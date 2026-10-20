// OPTIONAL one-time import of data from the old localStorage prototype.
//
// 1. Open the old website.html in the browser that has the data, open the
//    developer console (F12) and run:
//      copy(JSON.stringify({ambulances: JSON.parse(localStorage.asm_ambs_v1||"[]"),
//        requests: JSON.parse(localStorage.asm_reqs_v1||"[]"),
//        feedback: JSON.parse(localStorage.asm_feedback_v1||"[]")}))
//    Paste the result into a file, e.g. legacy-export.json.
// 2. Run:  npm run import-legacy -- legacy-export.json          (dry run)
//          npm run import-legacy -- legacy-export.json --apply  (writes)
//
// What is imported and what is NOT:
// - Ambulances: imported by ID (A101 ...). Existing codes are skipped.
// - Requests: imported as bookings ONLY when their userEmail matches an account
//   that already exists in MongoDB. Drivers are linked only if the driver email
//   matches an existing driver account. Imported bookings keep their status but
//   never hold an ambulance/driver "busy" (active ones are imported unassigned).
// - Feedback: imported for imported, completed bookings.
// - User accounts/passwords are NEVER imported: the old file stored them in
//   plain text and anyone could have edited them in their browser. Users must
//   register again, and drivers/admins must be created by an administrator.

import fs from "node:fs";
import { config } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { Ambulance } from "../models/Ambulance.js";
import { Booking } from "../models/Booking.js";
import { Driver } from "../models/Driver.js";
import { Feedback } from "../models/Feedback.js";
import { User } from "../models/User.js";

const STATUSES = new Set(["new", "pending", "enroute", "arrived", "completed"]);

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) throw new Error("Usage: npm run import-legacy -- <export.json> [--apply]");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  await connectDB(config.mongoUri);
  const report = { ambulances: 0, bookings: 0, feedback: 0, skipped: [] };

  for (const a of Array.isArray(data.ambulances) ? data.ambulances : []) {
    const code = String(a.id || "").toUpperCase().trim();
    if (!/^[A-Z0-9-]{1,20}$/.test(code)) { report.skipped.push(`ambulance with invalid id ${a.id}`); continue; }
    if (await Ambulance.exists({ code })) { report.skipped.push(`ambulance ${code} already exists`); continue; }
    if (apply) {
      await Ambulance.create({
        code,
        vehicle: String(a.vehicle || `Ambulance ${code}`).slice(0, 100),
        status: a.status === "maintenance" ? "maintenance" : "available",
      });
    }
    report.ambulances++;
  }

  const fbByReq = new Map((Array.isArray(data.feedback) ? data.feedback : []).map((f) => [f.reqId, f]));

  for (const r of Array.isArray(data.requests) ? data.requests : []) {
    const id = String(r.id || "");
    if (!/^REQ\d{3,6}$/.test(id)) { report.skipped.push(`request with invalid id ${r.id}`); continue; }
    if (await Booking.exists({ bookingId: id })) { report.skipped.push(`booking ${id} already exists`); continue; }
    const owner = await User.findOne({ email: String(r.userEmail || "").toLowerCase(), role: "user" });
    if (!owner) { report.skipped.push(`${id}: no registered user ${r.userEmail}`); continue; }
    const when = new Date(String(r.datetime || "").replace(" ", "T"));
    if (Number.isNaN(when.getTime())) { report.skipped.push(`${id}: invalid date ${r.datetime}`); continue; }

    const status = STATUSES.has(r.status) ? r.status : "new";
    const completed = status === "completed";
    let driver = null;
    let ambulance = null;
    if (completed) {
      const driverUser = await User.findOne({ email: String(r.driverEmail || "").toLowerCase(), role: "driver" });
      driver = driverUser ? await Driver.findOne({ user: driverUser._id }) : null;
      ambulance = r.ambulanceId ? await Ambulance.findOne({ code: String(r.ambulanceId).toUpperCase() }) : null;
    }

    if (apply) {
      const booking = await Booking.create({
        bookingId: id,
        user: owner._id,
        pickup: String(r.pickup || "").slice(0, 200) || "(unknown)",
        destination: String(r.dest || "").slice(0, 200) || "(unknown)",
        scheduledFor: when,
        // Active legacy requests come in as "new" so an admin re-assigns them properly.
        status: completed ? "completed" : "new",
        ambulance: ambulance?._id ?? null,
        driver: driver?._id ?? null,
        completedAt: completed ? when : null,
        statusHistory: [{ status: completed ? "completed" : "new", at: new Date() }],
      });
      const fb = fbByReq.get(id);
      const rating = Number.parseInt(fb?.rating, 10);
      if (completed && fb && rating >= 1 && rating <= 5) {
        await Feedback.create({
          booking: booking._id,
          user: owner._id,
          rating,
          comments: String(fb.comments || "").slice(0, 1000),
        });
        report.feedback++;
      }
    }
    report.bookings++;
  }

  console.log(apply ? "Imported:" : "DRY RUN (nothing written). Would import:");
  console.log(`  ambulances: ${report.ambulances}\n  bookings:   ${report.bookings}`);
  if (apply) console.log(`  feedback:   ${report.feedback}`);
  if (report.skipped.length) console.log("Skipped:\n  " + report.skipped.join("\n  "));
  if (!apply) console.log("\nRe-run with --apply to write these records.");
}

main()
  .catch((err) => {
    console.error("✖", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
