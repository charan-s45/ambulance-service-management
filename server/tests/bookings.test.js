import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Booking } from "../models/Booking.js";
import {
  browser,
  clearDb,
  createAdmin,
  inMinutes,
  loggedIn,
  makeApp,
  registerUser,
  startDb,
  stopDb,
  validBooking,
} from "./helpers.js";

const app = makeApp();

describe("Bookings", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("an authenticated user can create a booking with a server-generated ID", async () => {
    const user = await registerUser(app);
    const res = await user.post("/api/bookings").send(validBooking());
    assert.equal(res.status, 201);
    const b = res.body.data;
    assert.match(b.bookingId, /^REQ\d{6}$/);
    assert.equal(b.status, "new");
    assert.equal(b.ambulance, null);
    assert.equal(b.driver, null);
    // ETA is the configurable default, clearly labelled as such
    assert.equal(b.eta.source, "default_estimate");
    assert.equal(b.eta.minutes, 15);
  });

  it("ignores client attempts to set the ID, owner or status (mass assignment)", async () => {
    const user = await registerUser(app);
    const res = await user
      .post("/api/bookings")
      .send({ ...validBooking(), bookingId: "REQ000001", status: "completed", user: "000000000000000000000000" });
    assert.equal(res.status, 400);
    assert.equal(await Booking.countDocuments(), 0);
  });

  it("rejects invalid booking details", async () => {
    const user = await registerUser(app);
    const cases = [
      { ...validBooking(), pickup: "   " },
      { ...validBooking(), destination: "" },
      { ...validBooking(), pickup: "x".repeat(201) },
      { ...validBooking(), scheduledFor: "not-a-date" },
      { ...validBooking(), scheduledFor: inMinutes(-24 * 60) }, // yesterday
      { pickup: "A" }, // missing fields
    ];
    for (const body of cases) {
      const res = await user.post("/api/bookings").send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(res.body.error.message);
    }
  });

  it("requires a logged-in user (not anonymous, driver or admin)", async () => {
    assert.equal((await browser(app).post("/api/bookings").send(validBooking())).status, 401);
    const creds = await createAdmin();
    const admin = await loggedIn(app, creds.email, creds.password);
    assert.equal((await admin.post("/api/bookings").send(validBooking())).status, 403);
  });

  it("a user sees only their own bookings, and cannot open someone else's", async () => {
    const alice = await registerUser(app, "alice@test.com");
    const bob = await registerUser(app, "bob@test.com");
    const a = (await alice.post("/api/bookings").send(validBooking())).body.data;
    await bob.post("/api/bookings").send(validBooking());

    const mine = await alice.get("/api/bookings/my");
    assert.equal(mine.status, 200);
    assert.equal(mine.body.data.length, 1);
    assert.equal(mine.body.data[0].id, a.id);

    assert.equal((await alice.get(`/api/bookings/${a.id}`)).status, 200);
    assert.equal((await bob.get(`/api/bookings/${a.id}`)).status, 404);
    assert.equal((await bob.get(`/api/bookings/not-an-id`)).status, 400);
  });

  it("a booking made in one browser is visible to an admin in another browser and after re-login", async () => {
    const user = await registerUser(app);
    const created = (await user.post("/api/bookings").send(validBooking())).body.data;

    const creds = await createAdmin();
    const admin = await loggedIn(app, creds.email, creds.password);
    const all = await admin.get("/api/bookings");
    assert.equal(all.status, 200);
    assert.equal(all.body.data[0].bookingId, created.bookingId);
    assert.equal(all.body.data[0].user.email, "user@test.com");

    // Log out and back in from a brand-new browser: data is still there.
    await user.post("/api/auth/logout");
    const again = await loggedIn(app, "user@test.com", "UserPass123");
    const mine = await again.get("/api/bookings/my");
    assert.equal(mine.body.data[0].bookingId, created.bookingId);
  });
});
