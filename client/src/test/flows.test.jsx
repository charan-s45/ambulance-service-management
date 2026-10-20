import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api, ApiError } from "../api/apiClient.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { FlashProvider } from "../context/FlashContext.jsx";
import { FlashBanner } from "../components/StatusMessages.jsx";
import AuthPage from "../pages/AuthPage.jsx";
import BookAmbulance from "../pages/BookAmbulance.jsx";
import AdminDashboard from "../pages/AdminDashboard.jsx";

// A fake server: maps "METHOD /path" to a response. Used ONLY in tests.
function mockFetch(routes) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    const key = `${opts.method || "GET"} ${new URL(url, "http://x").pathname}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ error: { message: "Please log in to continue." } }), { status: 401 });
    const { status = 200, body } = typeof handler === "function" ? handler(opts) : handler;
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderApp(ui, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FlashProvider>
        <AuthProvider>
          <FlashBanner />
          <Routes>
            <Route path="*" element={ui} />
          </Routes>
          <Where />
        </AuthProvider>
      </FlashProvider>
    </MemoryRouter>,
  );
}

describe("apiClient", () => {
  it("sends cookies and the CSRF header, and parses { data }", async () => {
    const spy = mockFetch({ "GET /api/stats/public": { body: { data: { activeRequests: 1 } } } });
    const res = await api.get("/stats/public");
    expect(res.data.activeRequests).toBe(1);
    const [, opts] = spy.mock.calls[0];
    expect(opts.credentials).toBe("include");
    expect(opts.headers["X-Requested-With"]).toBe("XMLHttpRequest");
  });

  it("turns server errors into ApiError with the server message", async () => {
    mockFetch({ "POST /api/bookings": { status: 400, body: { error: { message: "Pickup location is required." } } } });
    await expect(api.post("/bookings", {})).rejects.toMatchObject({ status: 400, message: "Pickup location is required." });
  });

  it("reports network failures clearly instead of faking success", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await api.get("/stats/public").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK_ERROR");
  });
});

describe("Login flow", () => {
  it("logs in and redirects a user with no pending feedback to the user dashboard", async () => {
    const spy = mockFetch({
      "POST /api/auth/login": {
        body: { data: { id: "u1", name: "kavya", email: "k@x.com", role: "user" }, message: "Welcome, kavya (user)" },
      },
      "GET /api/bookings/my": { body: { data: [] } },
    });
    renderApp(<AuthPage />, "/login");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#login-email" }), { target: { value: "k@x.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "#login-pass" }), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "User Login" }));

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/dashboard"));
    expect(screen.getByText("Welcome, kavya (user)")).toBeTruthy();
    const loginCall = spy.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: "k@x.com", password: "secret123", role: "user" });
  });

  it("sends a user with a completed, unrated booking to the feedback form", async () => {
    mockFetch({
      "POST /api/auth/login": { body: { data: { id: "u1", name: "k", email: "k@x.com", role: "user" }, message: "Welcome" } },
      "GET /api/bookings/my": { body: { data: [{ id: "b1", status: "completed", feedback: null }] } },
    });
    renderApp(<AuthPage />, "/login");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#login-email" }), { target: { value: "k@x.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "#login-pass" }), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "User Login" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/feedback/b1"));
  });

  it("shows the server's error for bad credentials", async () => {
    mockFetch({
      "POST /api/auth/login": { status: 401, body: { error: { message: "Incorrect email or password." } } },
    });
    renderApp(<AuthPage />, "/login");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#login-email" }), { target: { value: "k@x.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "#login-pass" }), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "User Login" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/login");
  });

  it("offers separate User / Driver / Admin login and registration forms", async () => {
    mockFetch({});
    renderApp(<AuthPage />, "/login");
    expect(screen.getByRole("tab", { name: /User/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Register" })).toBeTruthy();
    expect(document.querySelector("#reg-name")).toBeNull(); // user form = email + password, as before

    fireEvent.click(screen.getByRole("tab", { name: /Driver/ }));
    expect(await screen.findByRole("button", { name: "Driver Login" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Register as Driver" })).toBeTruthy();
    expect(document.querySelector("#reg-name").required).toBe(true);
    expect(document.querySelector("#reg-license")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Admin/ }));
    expect(await screen.findByRole("button", { name: "Admin Login" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Register as Admin" })).toBeTruthy();
    expect(document.querySelector("#reg-admin-code").required).toBe(true);
  });

  it("driver registration sends the driver fields", async () => {
    const spy = mockFetch({
      "POST /api/auth/register": {
        status: 201,
        body: { data: { role: "driver" }, message: "Driver account created. You can now login with the Driver login." },
      },
    });
    renderApp(<AuthPage />, "/login?as=driver");
    fireEvent.change(document.querySelector("#reg-name"), { target: { value: "Suresh" } });
    fireEvent.change(document.querySelector("#reg-email"), { target: { value: "s@x.com" } });
    fireEvent.change(document.querySelector("#reg-pass"), { target: { value: "longpass1" } });
    fireEvent.change(document.querySelector("#reg-phone"), { target: { value: "555" } });
    fireEvent.change(document.querySelector("#reg-license"), { target: { value: "DL-1" } });
    fireEvent.submit(document.querySelector("#register-form"));
    expect(await screen.findByText(/Driver account created/)).toBeTruthy();
    const call = spy.mock.calls.find(([url]) => url.endsWith("/auth/register"));
    expect(JSON.parse(call[1].body)).toEqual({
      role: "driver", email: "s@x.com", password: "longpass1", name: "Suresh", phone: "555", licenseNumber: "DL-1",
    });
  });

  it("admin registration shows the server's error for a wrong code", async () => {
    mockFetch({
      "POST /api/auth/register": { status: 403, body: { error: { message: "Invalid admin registration code." } } },
    });
    renderApp(<AuthPage />, "/login?as=admin");
    fireEvent.change(document.querySelector("#reg-email"), { target: { value: "a@x.com" } });
    fireEvent.change(document.querySelector("#reg-pass"), { target: { value: "longpass1" } });
    fireEvent.change(document.querySelector("#reg-admin-code"), { target: { value: "guess" } });
    fireEvent.submit(document.querySelector("#register-form"));
    expect(await screen.findByText("Invalid admin registration code.")).toBeTruthy();
  });

  it("admin login sends role=admin and lands on the admin dashboard", async () => {
    const spy = mockFetch({
      "POST /api/auth/login": { body: { data: { id: "a1", name: "Admin", role: "admin" }, message: "Welcome, Admin (admin)" } },
    });
    renderApp(<AuthPage />, "/login?as=admin");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#login-email" }), { target: { value: "a@x.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "#login-pass" }), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Admin Login" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin"));
    const loginCall = spy.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(loginCall[1].body).role).toBe("admin");
  });

  it("shows the server message when the login type does not match the account", async () => {
    mockFetch({
      "POST /api/auth/login": {
        status: 403,
        body: { error: { message: 'This is not an admin account. Please choose the "user" login.' } },
      },
    });
    renderApp(<AuthPage />, "/login?as=admin");
    fireEvent.change(screen.getByLabelText("Email", { selector: "#login-email" }), { target: { value: "k@x.com" } });
    fireEvent.change(screen.getByLabelText("Password", { selector: "#login-pass" }), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Admin Login" }));
    expect(await screen.findByText('This is not an admin account. Please choose the "user" login.')).toBeTruthy();
  });
});

describe("Booking page", () => {
  it("redirects to login when submitting without a user session (as the prototype did)", async () => {
    mockFetch({});
    renderApp(<BookAmbulance />, "/book");
    await screen.findByText("Please log in as a User to submit a booking.");
    fireEvent.change(screen.getByLabelText("Pickup Location"), { target: { value: "Main St" } });
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Hospital" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:00" } });
    fireEvent.submit(document.querySelector("#booking-form"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
    expect(screen.getByText("You must be logged in as a User to book an ambulance.")).toBeTruthy();
  });
});

describe("Admin dashboard", () => {
  it("shows an error with Retry when the API fails, and empty states when there is no data", async () => {
    let fail = true;
    mockFetch({
      "GET /api/auth/me": { body: { data: { id: "a", name: "Admin", role: "admin" } } },
      "GET /api/stats/admin": () =>
        fail ? { status: 500, body: { error: { message: "Something went wrong on the server. Please try again." } } }
          : { body: { data: { activeRequests: 0, newRequests: 0, availableAmbulances: 0, totalDrivers: 0, availableDrivers: 0, completedBookings: 0, totalBookings: 0, totalUsers: 0, feedbackCount: 0, averageRating: null } } },
      "GET /api/bookings": { body: { data: [] } },
      "GET /api/ambulances": { body: { data: [] } },
      "GET /api/drivers": { body: { data: [] } },
      "GET /api/users": { body: { data: [] } },
      "GET /api/feedback": { body: { data: [] } },
    });
    renderApp(<AdminDashboard />, "/admin");
    expect(await screen.findByText("Something went wrong on the server. Please try again.")).toBeTruthy();
    expect(await screen.findByText("No requests yet.")).toBeTruthy();
    expect(screen.getByText("No ambulances yet. Add one below.")).toBeTruthy();
    expect(screen.getByText("No feedback submitted yet.")).toBeTruthy();

    fail = false;
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
    await waitFor(() => expect(document.querySelector("#admin-active")?.textContent).toBe("0"));
  });
});

describe("User dashboard", () => {
  it("shows counts, the active booking and recent bookings from the API", async () => {
    const { default: UserDashboard } = await import("../pages/UserDashboard.jsx");
    mockFetch({
      "GET /api/auth/me": { body: { data: { id: "u1", name: "Kavya", role: "user" } } },
      "GET /api/bookings/my": {
        body: {
          data: [
            {
              id: "b2", bookingId: "REQ222222", pickup: "Oak Ave", destination: "Clinic", status: "enroute",
              scheduledFor: new Date().toISOString(),
              eta: { minutes: 9, source: "driver", updatedAt: new Date().toISOString() },
              driver: { name: "Ramesh", phone: "" }, ambulance: { vehicle: "Ambulance A101" }, feedback: null,
            },
            {
              id: "b1", bookingId: "REQ111111", pickup: "Main St", destination: "Hospital", status: "completed",
              scheduledFor: new Date().toISOString(), eta: {}, driver: null, ambulance: null, feedback: { rating: 4 },
            },
          ],
        },
      },
    });
    renderApp(<UserDashboard />, "/dashboard");
    expect(await screen.findByText("Welcome, Kavya")).toBeTruthy();
    expect(screen.getByText("Total Bookings").nextSibling.textContent).toBe("2");
    expect(screen.getByText("Active").nextSibling.textContent).toBe("1");
    expect(screen.getByText("Completed", { selector: "small" }).nextSibling.textContent).toBe("1");
    expect(screen.getByText("Your Active Booking Status", { exact: false })).toBeTruthy();
    expect(screen.getAllByText("REQ222222").length).toBeGreaterThan(0);
    expect(screen.getByText("4/5")).toBeTruthy();
  });
});
