import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Ambulance } from "../models/Ambulance.js";
import { Driver } from "../models/Driver.js";
import { Booking } from "../models/Booking.js";
import { clearDb, makeApp, startDb, stopDb, validBooking, world } from "./helpers.js";

const app = makeApp();

describe("Ambulance and driver assignment", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("admin assigns an available ambulance and driver; the user sees the details", async () => {
    const w = await world(app);
    const booking = (await w.user.post("/api/bookings").send(validBooking())).body.data;

    const res = await w.admin
      .post(`/api/bookings/${booking.id}/assign`)
      .send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, "pending");

    const amb = await Ambulance.findById(w.ambulanceIds[0]);
    const drv = await Driver.findById(w.driverId);
    assert.equal(amb.status, "assigned");
    assert.equal(drv.status, "assigned");
    assert.equal(amb.currentBooking.toString(), booking.id);

    const mine = (await w.user.get("/api/bookings/my")).body.data[0];
    assert.equal(mine.ambulance.code, "A101");
    assert.equal(mine.driver.name, "Ramesh");

    // The assigned driver sees it on their dashboard
    const assigned = (await w.driver.get("/api/bookings/assigned")).body.data;
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].id, booking.id);
  });

  it("unavailable resources cannot be assigned, and failure does not leave anything occupied", async () => {
    const w = await world(app);
    const b1 = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    const b2 = (await w.user.post("/api/bookings").send(validBooking())).body.data;

    await w.admin.post(`/api/bookings/${b1.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });

    // A102 is free but the only driver is busy → whole assignment must fail
    const res = await w.admin
      .post(`/api/bookings/${b2.id}/assign`)
      .send({ ambulanceId: w.ambulanceIds[1], driverId: w.driverId });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /Driver Ramesh is not available/);
    assert.equal((await Ambulance.findById(w.ambulanceIds[1])).status, "available", "A102 must be rolled back");

    // Ambulance in maintenance cannot be assigned
    await w.admin.patch(`/api/ambulances/${w.ambulanceIds[1]}`).send({ status: "maintenance" });
    const res2 = await w.admin
      .post(`/api/bookings/${b2.id}/assign`)
      .send({ ambulanceId: w.ambulanceIds[1], driverId: w.driverId });
    assert.equal(res2.status, 409);
    assert.match(res2.body.error.message, /maintenance/);
  });

  it("two simultaneous assignments of the same resources: exactly one succeeds", async () => {
    const w = await world(app);
    // A second driver so each request could otherwise succeed on its own
    const d2 = await w.admin
      .post("/api/drivers")
      .send({ name: "Suresh", email: "driver2@test.com", password: "DriverPass123" });
    const b1 = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    const b2 = (await w.user.post("/api/bookings").send(validBooking())).body.data;

    for (let round = 0; round < 5; round++) {
      const [r1, r2] = await Promise.all([
        w.admin.post(`/api/bookings/${b1.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId }),
        w.admin.post(`/api/bookings/${b2.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: d2.body.data.id }),
      ]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409], `round ${round}: ${statuses}`);

      const holders = await Ambulance.find({ status: "assigned" });
      assert.equal(holders.length, 1);
      // The losing request's driver must have been released again
      assert.equal(await Driver.countDocuments({ status: "assigned" }), 1);

      // Reset for the next round
      const winner = r1.status === 200 ? b1 : b2;
      const winnerDriver = r1.status === 200 ? w.driverId : d2.body.data.id;
      await Ambulance.updateOne({ _id: w.ambulanceIds[0] }, { status: "available", currentBooking: null });
      await Driver.updateOne({ _id: winnerDriver }, { status: "available", currentBooking: null });
      await Booking.updateOne({ _id: winner.id }, { status: "new", ambulance: null, driver: null });
    }
  });

  it("re-assigning a pending booking releases the previous ambulance", async () => {
    const w = await world(app);
    const b = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    await w.admin.post(`/api/bookings/${b.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });
    const res = await w.admin
      .post(`/api/bookings/${b.id}/assign`)
      .send({ ambulanceId: w.ambulanceIds[1], driverId: w.driverId });
    assert.equal(res.status, 200);
    assert.equal((await Ambulance.findById(w.ambulanceIds[0])).status, "available");
    assert.equal((await Ambulance.findById(w.ambulanceIds[1])).status, "assigned");
    assert.equal((await Driver.findById(w.driverId)).status, "assigned");
  });

  it("only admins can assign", async () => {
    const w = await world(app);
    const b = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    const body = { ambulanceId: w.ambulanceIds[0], driverId: w.driverId };
    assert.equal((await w.user.post(`/api/bookings/${b.id}/assign`).send(body)).status, 403);
    assert.equal((await w.driver.post(`/api/bookings/${b.id}/assign`).send(body)).status, 403);
  });

  it("assigned ambulances/drivers cannot be deleted or put in maintenance", async () => {
    const w = await world(app);
    const b = (await w.user.post("/api/bookings").send(validBooking())).body.data;
    await w.admin.post(`/api/bookings/${b.id}/assign`).send({ ambulanceId: w.ambulanceIds[0], driverId: w.driverId });

    assert.equal((await w.admin.delete(`/api/ambulances/${w.ambulanceIds[0]}`)).status, 409);
    assert.equal((await w.admin.patch(`/api/ambulances/${w.ambulanceIds[0]}`).send({ status: "maintenance" })).status, 409);
    assert.equal((await w.admin.delete(`/api/drivers/${w.driverId}`)).status, 409);
    assert.equal((await w.admin.patch(`/api/drivers/${w.driverId}`).send({ status: "off_duty" })).status, 409);
    // Free ones can be managed
    assert.equal((await w.admin.patch(`/api/ambulances/${w.ambulanceIds[1]}`).send({ vehicle: "Type II Van" })).status, 200);
    assert.equal((await w.admin.delete(`/api/ambulances/${w.ambulanceIds[1]}`)).status, 200);
  });

  it("ambulance and driver management validates input and prevents duplicates", async () => {
    const w = await world(app);
    assert.equal((await w.admin.post("/api/ambulances").send({ code: "A101", vehicle: "dup" })).status, 409);
    assert.equal((await w.admin.post("/api/ambulances").send({ code: "bad id!", vehicle: "x" })).status, 400);
    assert.equal((await w.admin.patch(`/api/ambulances/${w.ambulanceIds[1]}`).send({ status: "assigned" })).status, 400);
    assert.equal(
      (await w.admin.post("/api/drivers").send({ name: "X", email: "driver@test.com", password: "longenough1" })).status,
      409,
    );
    const list = await w.admin.get("/api/drivers");
    assert.equal(list.body.data[0].email, "driver@test.com");
    assert.equal(JSON.stringify(list.body).includes("passwordHash"), false);
  });
});
