import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Feedback } from "../models/Feedback.js";
import { browser, clearDb, makeApp, registerUser, startDb, stopDb, validBooking, world } from "./helpers.js";

const app = makeApp();

async function completedBooking(w) {
  const b = (await w.user.post("/api/bookings").send(validBooking())).body.data;
  await w.admin.post(`/api/bookings/${b.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });
  await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 5 });
  await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "arrived" });
  await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "completed" });
  return b;
}

describe("Feedback", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("the owner can leave feedback once for a completed booking; it is stored in MongoDB", async () => {
    const w = await world(app);
    const b = await completedBooking(w);
    const res = await w.user.post("/api/feedback").send({ bookingId: b.id, rating: 5, comments: "Very fast" });
    assert.equal(res.status, 201);
    assert.match(res.body.message, /Rating: 5\/5/);
    const stored = await Feedback.findOne().lean();
    assert.equal(stored.rating, 5);
    assert.equal(stored.comments, "Very fast");

    const again = await w.user.post("/api/feedback").send({ bookingId: b.id, rating: 1 });
    assert.equal(again.status, 409);

    // Booking list shows the feedback so the UI stops asking for it
    const mine = (await w.user.get("/api/bookings/my")).body.data[0];
    assert.equal(mine.feedback.rating, 5);
  });

  it("validates feedback and blocks it for unfinished or other people's bookings", async () => {
    const w = await world(app);
    const open = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    assert.equal((await w.user.post("/api/feedback").send({ bookingId: open.id, rating: 4 })).status, 409);

    const done = await completedBooking(w);
    assert.equal((await w.user.post("/api/feedback").send({ bookingId: done.id, rating: 6 })).status, 400);
    assert.equal((await w.user.post("/api/feedback").send({ bookingId: done.id })).status, 400);
    assert.equal(
      (await w.user.post("/api/feedback").send({ bookingId: done.id, rating: 3, comments: "x".repeat(1001) })).status,
      400,
    );

    const stranger = await registerUser(app, "stranger@test.com");
    assert.equal((await stranger.post("/api/feedback").send({ bookingId: done.id, rating: 1 })).status, 404);
    assert.equal(await Feedback.countDocuments(), 0);
  });

  it("only admins can read feedback", async () => {
    const w = await world(app);
    const b = await completedBooking(w);
    await w.user.post("/api/feedback").send({ bookingId: b.id, rating: 4, comments: "Good" });

    assert.equal((await w.user.get("/api/feedback")).status, 403);
    assert.equal((await w.driver.get("/api/feedback")).status, 403);
    assert.equal((await browser(app).get("/api/feedback")).status, 401);

    const res = await w.admin.get("/api/feedback");
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].bookingId, b.bookingId);
    assert.equal(res.body.data[0].user.email, "user@test.com");

    // Admin booking table carries the rating (the "Feedback" column)
    const all = (await w.admin.get("/api/bookings")).body.data;
    assert.equal(all.find((x) => x.id === b.id).feedback.rating, 4);
  });
});

describe("Dashboard statistics", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("empty database returns zeros, not errors", async () => {
    const res = await browser(app).get("/api/stats/public");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { activeRequests: 0, availableAmbulances: 0, totalDrivers: 0 });
  });

  it("statistics match the stored records", async () => {
    const w = await world(app);
    await completedBooking(w);
    const done2 = await completedBooking(w);
    await w.user.post("/api/feedback").send({ bookingId: done2.id, rating: 3 });
    const open = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    await w.user.post("/api/bookings").send(validBooking());
    await w.admin.post(`/api/bookings/${open.id}/assign`).send({ ambulanceId: w.ambulanceIds[1], driverId: w.driverId });

    const pub = (await browser(app).get("/api/stats/public")).body.data;
    assert.deepEqual(pub, { activeRequests: 2, availableAmbulances: 1, totalDrivers: 1 });

    const admin = (await w.admin.get("/api/stats/admin")).body.data;
    assert.equal(admin.totalBookings, 4);
    assert.equal(admin.completedBookings, 2);
    assert.equal(admin.newRequests, 1);
    assert.equal(admin.availableDrivers, 0);
    assert.equal(admin.totalUsers, 1);
    assert.equal(admin.feedbackCount, 1);
    assert.equal(admin.averageRating, 3);
  });

  it("unknown API routes and malformed JSON return clean JSON errors", async () => {
    const res = await browser(app).get("/api/nope");
    assert.equal(res.status, 404);
    assert.ok(res.body.error.message);
    const bad = await browser(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, "BAD_JSON");
    assert.equal(JSON.stringify(bad.body).includes("stack"), false);
  });
});
