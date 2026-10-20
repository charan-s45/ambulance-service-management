import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Ambulance } from "../models/Ambulance.js";
import { Driver } from "../models/Driver.js";
import { clearDb, loggedIn, makeApp, registerUser, startDb, stopDb, validBooking, world } from "./helpers.js";

const app = makeApp();

async function assignedBooking(w) {
  const b = (await w.user.post("/api/bookings").send(validBooking())).body.data;
  await w.admin.post(`/api/bookings/${b.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });
  return b;
}

describe("Status tracking and ETA", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("valid transitions succeed end-to-end and completion frees the resources", async () => {
    const w = await world(app);
    const b = await assignedBooking(w);

    const enroute = await w.driver.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 12 });
    assert.equal(enroute.status, 200, JSON.stringify(enroute.body));
    assert.equal(enroute.body.data.eta.minutes, 12);
    assert.equal(enroute.body.data.eta.source, "driver");

    // The user sees the new status/ETA on their next refresh
    const seen = (await w.user.get(`/api/bookings/${b.id}`)).body.data;
    assert.equal(seen.status, "enroute");
    assert.equal(seen.eta.minutes, 12);

    assert.equal((await w.driver.patch(`/api/bookings/${b.id}/status`).send({ status: "arrived" })).status, 200);
    const done = await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "completed" });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.eta.minutes, null);
    assert.ok(done.body.data.completedAt);
    assert.deepEqual(
      done.body.data.statusHistory.map((h) => h.status),
      ["new", "pending", "enroute", "arrived", "completed"],
    );

    assert.equal((await Ambulance.findById(w.ambulanceIds[0])).status, "available");
    assert.equal((await Driver.findById(w.driverId)).status, "available");
  });

  it("invalid transitions are rejected", async () => {
    const w = await world(app);
    const unassigned = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    const r0 = await w.admin.patch(`/api/bookings/${unassigned.id}/status`).send({ status: "enroute", etaMinutes: 5 });
    assert.equal(r0.status, 409);

    const b = await assignedBooking(w);
    // skip ahead
    assert.equal((await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "completed" })).status, 409);
    assert.equal((await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "arrived" })).status, 409);
    // unknown / backwards status values are rejected by validation
    assert.equal((await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "new" })).status, 400);
    assert.equal((await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "flying" })).status, 400);
    // en route requires a valid ETA (same rule as the prototype)
    const noEta = await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute" });
    assert.equal(noEta.status, 400);
    assert.match(noEta.body.error.message, /ETA/);
    assert.equal(
      (await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 0 })).status,
      400,
    );
    // admin-set ETA is labelled "dispatcher"
    const ok = await w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 8 });
    assert.equal(ok.body.data.eta.source, "dispatcher");
  });

  it("unauthorized status updates are rejected", async () => {
    const w = await world(app);
    const b = await assignedBooking(w);
    // the booking owner cannot change status
    assert.equal((await w.user.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 5 })).status, 403);
    // a driver who is not assigned cannot change it
    await w.admin.post("/api/drivers").send({ name: "Other", email: "other@test.com", password: "DriverPass123" });
    const other = await loggedIn(app, "other@test.com", "DriverPass123");
    const res = await other.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 5 });
    assert.equal(res.status, 403);
    assert.equal((await other.get(`/api/bookings/${b.id}`)).status, 404);
  });

  it("ETA can be updated while pending/en route by admin or assigned driver", async () => {
    const w = await world(app);
    const b = await assignedBooking(w);
    const r1 = await w.admin.patch(`/api/bookings/${b.id}/eta`).send({ etaMinutes: 20 });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.data.eta.source, "dispatcher");
    const r2 = await w.driver.patch(`/api/bookings/${b.id}/eta`).send({ etaMinutes: 18 });
    assert.equal(r2.body.data.eta.source, "driver");
    assert.equal((await w.user.patch(`/api/bookings/${b.id}/eta`).send({ etaMinutes: 1 })).status, 403);
    assert.equal((await w.admin.patch(`/api/bookings/${b.id}/eta`).send({ etaMinutes: -3 })).status, 400);
  });

  it("a concurrent double 'arrived' update only applies once", async () => {
    const w = await world(app);
    const b = await assignedBooking(w);
    await w.driver.patch(`/api/bookings/${b.id}/status`).send({ status: "enroute", etaMinutes: 5 });
    const [r1, r2] = await Promise.all([
      w.driver.patch(`/api/bookings/${b.id}/status`).send({ status: "arrived" }),
      w.admin.patch(`/api/bookings/${b.id}/status`).send({ status: "arrived" }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
    const final = (await w.admin.get(`/api/bookings/${b.id}`)).body.data;
    assert.equal(final.statusHistory.filter((h) => h.status === "arrived").length, 1);
  });

  it("the other user cannot see status of someone else's booking", async () => {
    const w = await world(app);
    const b = await assignedBooking(w);
    const stranger = await registerUser(app, "stranger@test.com");
    assert.equal((await stranger.get(`/api/bookings/${b.id}`)).status, 404);
  });
});
