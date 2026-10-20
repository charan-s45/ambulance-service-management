# API reference

Base path: `/api`. All bodies are JSON.

- **Success:** `{ "data": ..., "message"?: "..." }`
- **Error:** `{ "error": { "message": "...", "code": "VALIDATION_ERROR", "details"?: [{ "field", "message" }] } }`
- Every `POST` / `PATCH` / `DELETE` must send the header `X-Requested-With: XMLHttpRequest` (CSRF protection).
  Without it the server returns `403`.
- Authentication uses the `asm_token` HttpOnly cookie that `POST /auth/login` sets.
  Browsers must send credentials (`fetch(..., { credentials: "include" })`).
- IDs in URLs (`:id`) are MongoDB ObjectIds (24 hex characters), **not** the `REQ123456` display ID.

| Status | Meaning |
|---|---|
| 400 | Invalid input (message says what is wrong) |
| 401 | Not logged in / session expired |
| 403 | Logged in but not allowed (wrong role / not your assignment / missing CSRF header) |
| 404 | Not found, **or** belongs to someone else (so other people's bookings stay private) |
| 409 | Conflict: resource busy, invalid status transition, duplicate, or changed concurrently |
| 429 | Rate limited |

## Auth

| Method & path | Who | Body | Result |
|---|---|---|---|
| `POST /auth/register` | anyone | `{ role?: "user"\|"driver"\|"admin" (default user), email, password (8–72), name?, phone? }`. Driver: `name` required, optional `licenseNumber`; also creates the driver profile (status `available`). Admin: `adminCode` must equal the server's `ADMIN_REGISTRATION_CODE` | 201. 403 `INVALID_ADMIN_CODE` / `ADMIN_REGISTRATION_DISABLED` |
| `POST /auth/login` | anyone | `{ email, password, role? }`. `role` is the login type chosen on the page (`user`/`driver`/`admin`); it only has to **match** the account, it never grants a role | 200, sets cookie, `data` = `{ id, name, email, role, phone }`. 403 `WRONG_LOGIN_TYPE` if `role` does not match the account |
| `POST /auth/logout` | anyone | – | clears cookie |
| `GET /auth/me` | logged in | – | current user |

## Bookings

| Method & path | Who | Body / query | Notes |
|---|---|---|---|
| `POST /bookings` | user | `{ pickup (≤200), destination (≤200), scheduledFor (ISO date-time with offset) }` | Booking ID generated server-side; `scheduledFor` may not be more than 1 h in the past or more than 1 year ahead |
| `GET /bookings/my` | user | – | Own bookings, newest first, with `feedback` |
| `GET /bookings/assigned` | driver | – | Bookings assigned to this driver (includes patient name/phone) |
| `GET /bookings` | admin | `?status=new\|pending\|enroute\|arrived\|completed` | All bookings (max 500, newest first) |
| `GET /bookings/:id` | owner, admin, assigned driver | – | Others get 404 |
| `POST /bookings/:id/assign` | admin | `{ ambulanceId, driverId }` | Booking must be `new` or `pending`; both resources must be `available` (or already on this booking). Re-assigning releases the previous ones |
| `PATCH /bookings/:id/status` | admin, assigned driver | `{ status: "enroute"\|"arrived"\|"completed", etaMinutes? }` | Only the next status is accepted. `etaMinutes` (1–600) is required for `enroute`. `completed` frees ambulance and driver |
| `PATCH /bookings/:id/eta` | admin, assigned driver | `{ etaMinutes }` | Only while `pending` or `enroute` |

Booking object:

```json
{
  "id": "665f...", "bookingId": "REQ482913",
  "pickup": "12 Main St.", "destination": "City General Hospital",
  "scheduledFor": "2026-10-20T05:00:00.000Z",
  "status": "enroute",
  "eta": { "minutes": 12, "source": "driver", "updatedAt": "..." },
  "ambulance": { "id": "...", "code": "A101", "vehicle": "Ambulance A101", "registrationNumber": "" },
  "driver": { "id": "...", "name": "Ramesh", "phone": "+91 ..." },
  "statusHistory": [{ "status": "new", "at": "..." }, ...],
  "feedback": { "rating": 5, "comments": "..." } | null,
  "user": { "id", "name", "email", "phone" },   // admin & driver views only
  "completedAt": null, "createdAt": "...", "updatedAt": "..."
}
```

`eta.source` is one of:

- `default_estimate`: the configurable `DEFAULT_ETA_MINUTES`. It is **not** a prediction for this trip.
- `dispatcher`: entered by an admin.
- `driver`: entered by the driver.

None of these come from GPS.

## Ambulances (admin only)

| Method & path | Body | Notes |
|---|---|---|
| `GET /ambulances` | – | Includes `currentBooking { bookingId, status }` |
| `POST /ambulances` | `{ code: "A104", vehicle, registrationNumber? }` | `code` is unique, letters/digits/`-` |
| `PATCH /ambulances/:id` | any of `{ vehicle, registrationNumber, status: "available"\|"maintenance" }` | Status cannot be changed while `assigned` (409) |
| `DELETE /ambulances/:id` | – | Refused while `assigned` (409) |

## Drivers (admin only)

| Method & path | Body | Notes |
|---|---|---|
| `GET /drivers` | – | `{ id, userId, name, email, phone, licenseNumber, status, currentBooking }` |
| `POST /drivers` | `{ name, email, password, phone?, licenseNumber? }` | Creates the driver's login (role `driver`) and profile |
| `PATCH /drivers/:id` | any of `{ name, phone, licenseNumber, status: "available"\|"off_duty" }` | Status cannot be changed while `assigned` |
| `DELETE /drivers/:id` | – | Refused while `assigned`; deletes profile and login. Past bookings show "Removed driver" |

## Feedback

| Method & path | Who | Body | Notes |
|---|---|---|---|
| `POST /feedback` | user | `{ bookingId (ObjectId), rating (1–5 integer), comments? (≤1000) }` | Own **completed** booking only, once per booking |
| `GET /feedback` | admin | – | `{ id, bookingId, user { name, email }, rating, comments, createdAt }` |

Feedback cannot be edited or deleted through the API.

## Users & statistics

| Method & path | Who | Result |
|---|---|---|
| `GET /users` | admin | `{ id, name, email, role, phone, createdAt }` (no password data) |
| `GET /stats/public` | anyone | `{ activeRequests, availableAmbulances, totalDrivers }` (Home page counters) |
| `GET /stats/admin` | admin | above + `newRequests, completedBookings, totalBookings, availableDrivers, totalUsers, feedbackCount, averageRating` |
| `GET /health` | anyone | `{ status: "ok" }` (for uptime checks) |
