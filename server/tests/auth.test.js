import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { User } from "../models/User.js";
import { browser, clearDb, createAdmin, loggedIn, makeApp, registerUser, startDb, stopDb } from "./helpers.js";

const app = makeApp();

describe("Registration and authentication", () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it("registers a user, stores only a bcrypt hash, and logs in", async () => {
    const b = browser(app);
    const reg = await b.post("/api/auth/register").send({ email: "Kavya@Example.com", password: "secret-pass-1" });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.data.email, "kavya@example.com");
    assert.equal(reg.body.data.name, "kavya"); // same default as the prototype
    assert.equal(reg.body.data.role, "user");
    assert.equal(reg.body.data.passwordHash, undefined);

    const stored = await User.findOne({ email: "kavya@example.com" }).select("+passwordHash").lean();
    assert.notEqual(stored.passwordHash, "secret-pass-1");
    assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
    assert.equal(JSON.stringify(stored).includes("secret-pass-1"), false);

    const login = await b.post("/api/auth/login").send({ email: "kavya@example.com", password: "secret-pass-1" });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"].join(";");
    assert.match(cookie, /asm_token=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const me = await b.get("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, "kavya@example.com");
  });

  it("rejects duplicate accounts (case-insensitive email)", async () => {
    await registerUser(app, "dup@test.com");
    const res = await browser(app).post("/api/auth/register").send({ email: "DUP@test.com", password: "another-pass" });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /already exists/);
  });

  it("validates registration input", async () => {
    const b = browser(app);
    const badEmail = await b.post("/api/auth/register").send({ email: "not-an-email", password: "longenough" });
    assert.equal(badEmail.status, 400);
    const shortPw = await b.post("/api/auth/register").send({ email: "a@b.com", password: "short" });
    assert.equal(shortPw.status, 400);
    assert.match(shortPw.body.error.message, /at least 8/);
  });

  it("admin registration needs the secret admin code", async () => {
    const noCode = await browser(app)
      .post("/api/auth/register")
      .send({ email: "evil@test.com", password: "password123", role: "admin" });
    assert.equal(noCode.status, 403);
    const wrongCode = await browser(app)
      .post("/api/auth/register")
      .send({ email: "evil@test.com", password: "password123", role: "admin", adminCode: "guess" });
    assert.equal(wrongCode.status, 403);
    assert.equal(wrongCode.body.error.message, "Invalid admin registration code.");
    assert.equal(await User.exists({ email: "evil@test.com" }), null);
    // a user cannot sneak in an admin code
    const sneaky = await browser(app)
      .post("/api/auth/register")
      .send({ email: "evil@test.com", password: "password123", adminCode: "test-admin-code-123" });
    assert.equal(sneaky.status, 400);

    const ok = await browser(app)
      .post("/api/auth/register")
      .send({ email: "boss@test.com", password: "password123", role: "admin", adminCode: "test-admin-code-123" });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.role, "admin");
    const admin = await loggedIn(app, "boss@test.com", "password123");
    assert.equal((await admin.get("/api/users")).status, 200);
  });

  it("drivers can register themselves and appear in the admin's driver list", async () => {
    const missingName = await browser(app)
      .post("/api/auth/register")
      .send({ email: "d@test.com", password: "password123", role: "driver" });
    assert.equal(missingName.status, 400);
    assert.match(missingName.body.error.message, /Name is required/);

    const res = await browser(app).post("/api/auth/register").send({
      email: "d@test.com",
      password: "password123",
      role: "driver",
      name: "Suresh",
      phone: "555-0101",
      licenseNumber: "DL-42",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, "driver");

    const driver = browser(app);
    const login = await driver.post("/api/auth/login").send({ email: "d@test.com", password: "password123", role: "driver" });
    assert.equal(login.status, 200);
    assert.equal((await driver.get("/api/bookings/assigned")).status, 200);

    const creds = await createAdmin();
    const admin = await loggedIn(app, creds.email, creds.password);
    const drivers = (await admin.get("/api/drivers")).body.data;
    assert.equal(drivers.length, 1);
    assert.deepEqual(
      { name: drivers[0].name, phone: drivers[0].phone, licenseNumber: drivers[0].licenseNumber, status: drivers[0].status },
      { name: "Suresh", phone: "555-0101", licenseNumber: "DL-42", status: "available" },
    );
  });

  it("users cannot register with driver-only fields", async () => {
    const res = await browser(app)
      .post("/api/auth/register")
      .send({ email: "u@test.com", password: "password123", licenseNumber: "X" });
    assert.equal(res.status, 400);
  });

  it("rejects invalid credentials with one generic message", async () => {
    await registerUser(app, "real@test.com", "correct-pass");
    const wrongPw = await browser(app).post("/api/auth/login").send({ email: "real@test.com", password: "nope-nope" });
    const noUser = await browser(app).post("/api/auth/login").send({ email: "ghost@test.com", password: "nope-nope" });
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPw.body.error.message, noUser.body.error.message);
  });

  it("the chosen login type must match the account's real role", async () => {
    await registerUser(app, "pat@test.com", "PatientPass1");
    const asAdmin = await browser(app)
      .post("/api/auth/login")
      .send({ email: "pat@test.com", password: "PatientPass1", role: "admin" });
    assert.equal(asAdmin.status, 403);
    assert.match(asAdmin.body.error.message, /not an admin account/);
    assert.equal(asAdmin.headers["set-cookie"], undefined, "no session on mismatch");

    const asUser = await browser(app)
      .post("/api/auth/login")
      .send({ email: "pat@test.com", password: "PatientPass1", role: "user" });
    assert.equal(asUser.status, 200);

    // Wrong password with a role still gives the generic message
    const wrong = await browser(app)
      .post("/api/auth/login")
      .send({ email: "pat@test.com", password: "nope-nope", role: "admin" });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.message, "Incorrect email or password.");

    const bogus = await browser(app)
      .post("/api/auth/login")
      .send({ email: "pat@test.com", password: "PatientPass1", role: "superuser" });
    assert.equal(bogus.status, 400);
  });

  it("logout clears the session", async () => {
    const b = await registerUser(app);
    assert.equal((await b.get("/api/auth/me")).status, 200);
    await b.post("/api/auth/logout");
    assert.equal((await b.get("/api/auth/me")).status, 401);
  });

  it("rejects forged or tampered tokens", async () => {
    const b = browser(app).set("Cookie", "asm_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged");
    const res = await b.get("/api/auth/me");
    assert.equal(res.status, 401);
  });

  it("users cannot access admin-only routes", async () => {
    const user = await registerUser(app);
    for (const path of ["/api/users", "/api/bookings", "/api/ambulances", "/api/drivers", "/api/feedback", "/api/stats/admin"]) {
      const res = await user.get(path);
      assert.equal(res.status, 403, path);
    }
    const anon = browser(app);
    assert.equal((await anon.get("/api/users")).status, 401);
  });

  it("role comes from the database, not from anything the client sends", async () => {
    const user = await registerUser(app);
    // Extra headers/body fields claiming to be admin have no effect.
    const res = await user.get("/api/users").set("X-Role", "admin").send({ role: "admin" });
    assert.equal(res.status, 403);
  });

  it("admin can list users without password hashes", async () => {
    const creds = await createAdmin();
    await registerUser(app);
    const admin = await loggedIn(app, creds.email, creds.password);
    const res = await admin.get("/api/users");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.equal(JSON.stringify(res.body).includes("passwordHash"), false);
  });

  it("blocks state-changing requests without the CSRF header", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "x@test.com", password: "whatever1" });
    assert.equal(res.status, 403);
  });

  it("rate-limits repeated login attempts", async () => {
    const limited = makeApp({ limits: { auth: 3 } });
    const b = browser(limited);
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await b.post("/api/auth/login").send({ email: "x@test.com", password: "wrong-pass" })).status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });
});
