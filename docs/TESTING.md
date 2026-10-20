# Testing

## 1. Automated tests

```bash
npm test                 # from the project root: server then client
# or separately
cd server && npm test    # 40 API tests against a temporary in-memory MongoDB
cd client && npm test    # 33 React/component tests (Vitest + Testing Library)
```

The server tests start a **throw-away MongoDB** process with
`mongodb-memory-server`. They never touch the database in your `.env`. The
first run downloads a MongoDB binary (about 600 MB once unpacked) and needs
roughly 500 MB more free space for the test database.

If your system drive is short on space, point both somewhere else before running:

```powershell
# PowerShell
$env:MONGOMS_DOWNLOAD_DIR="D:\asm-tooling\mongodb-binaries"; $env:TEMP="D:\asm-tooling\tmp"; npm test
```

```bash
# bash
MONGOMS_DOWNLOAD_DIR=/path/with/space TMPDIR=/path/with/space npm test
```

### Results from the last run (2026-10-20, Node 24.19, Windows 11)

**Server: 37 passed, 0 failed**

| Suite | What is proven |
|---|---|
| Registration and authentication (12) | Register + login. Only a bcrypt `$2b$12$` hash is stored, never the password. Duplicate (case-insensitive) emails are rejected. Invalid email or short password is rejected. A `role` field at sign-up is rejected. Wrong-password and unknown-email errors are identical. Logout ends the session. Forged tokens are rejected. Users get 403 on every admin route and anonymous requests get 401. Fake role headers or body fields have no effect. The users list contains no hashes. Missing CSRF header gives 403. The login rate limit returns 429 |
| Bookings (6) | Create with a server ID and a labelled default ETA. Attempts to set ID, status or owner are rejected. Six kinds of invalid input are rejected. Anonymous and admin booking is refused. A user sees only their own bookings, and other users' bookings give 404. A booking is visible to the admin from another session, and after logout and re-login |
| Assignment (7) | Assign updates ambulance, driver and booking, and the user and driver both see it. A busy driver or a maintenance ambulance is refused, and the half-claimed ambulance is rolled back. **Two simultaneous assignments of the same ambulance, 5 rounds: always exactly one 200 and one 409**, and the loser's driver is released. Re-assign frees the old ambulance. Only admins can assign. Assigned resources cannot be deleted or changed. Duplicates and invalid input are rejected |
| Status & ETA (6) | The full path new → pending → enroute → arrived → completed works, the history is recorded and resources are freed. Skipping, going backwards, unknown statuses and missing or zero ETA are rejected. The owner and unassigned drivers get 403. ETA updates are labelled `dispatcher`/`driver`. A concurrent double "arrived" is applied once only |
| Feedback (3) | Stored in MongoDB, once only. Unfinished bookings, other people's bookings, a rating of 6, a missing rating and comments over 1000 characters are rejected. Users and drivers get 403 on the feedback list and anonymous requests get 401 |
| Dashboard statistics (3) | An empty database returns zeros. Counts match the stored records exactly. Unknown routes and malformed JSON return clean JSON errors with no stack trace |

**Client: 20 passed, 0 failed**: status badge labels, and HTML is not injected
from unknown values. The ETA wording says "not based on live location" or "not
live GPS". The booking-list helpers work. The API client sends cookies and the
CSRF header, shows server error messages and reports network failures (no fake
success). Login redirects to `/book` or to `/feedback/:id`, as in the prototype.
Bad credentials show the server message. There is no role selector. Booking
while logged out redirects to login with the original message. The admin
dashboard shows an error with Retry, then recovers, and shows empty states.

### End-to-end run against the real server

The real `server.js` was started in **production mode**, serving the built React
app, connected to a real MongoDB process. The admin came from `npm run
create-admin` and the ambulances from `npm run seed`. Three separate cookie
sessions (user, admin, driver) then went through the whole workflow over HTTP.
**All 31 checks passed.** They covered:

- The SPA deep link and assets are served, with security headers.
- The production cookie is `HttpOnly; Secure; SameSite=Lax`.
- The admin sees a booking created in another session.
- The maintenance ambulance A103 is refused.
- The user sees the assigned ambulance and driver, and the driver sees the patient.
- The driver cannot skip to "arrived".
- The user sees "en route" with the driver's ETA.
- Completing the booking frees the ambulance.
- Feedback works once, and the admin can read it while a user cannot.
- Statistics are correct.
- After logout the API refuses requests, and the data persists into a new session.
- Errors contain no stack trace.

The Vite dev proxy (`:5173 → :5000`) was also checked.

**Not automated:** visual appearance in a real browser. Please run the manual
checklist below once in Chrome/Edge and once on a phone-sized window.

## 2. Manual test checklist

Prepare: start the API and client (README §3.6), run `npm run create-admin`, and
optionally `npm run seed`. Use **two different browsers** (or one normal and one
private window) so that two people are logged in at once.

### Public pages
- [ ] Home shows the hero card, 3 counters (numbers, not "…") and Quick Actions; each Quick Action button opens the right page.
- [ ] About, Services (4 cards, hover lift) and Contact look like the old site.
- [ ] Footer shows the current year.
- [ ] Narrow the window below 900 px: the ☰ button appears and opens/closes the links.

### Registration & login
- [ ] Register a new email + 8-character password → "Account created. You can now login."
- [ ] Register the same email again → "User with this email already exists. Please login."
- [ ] Wrong password → "Incorrect email or password."
- [ ] Login as the new user → "Welcome, name (user)" → booking page.
- [ ] Navbar shows My Bookings, Dashboard and Logout; Login/SignUp is hidden.
- [ ] Refresh the page (F5): you stay logged in.

### Booking (browser 1, user)
- [ ] Log out, open Book, fill in the form and submit → "You must be logged in as a User…" and you are taken to the login page.
- [ ] Logged in: submit with an empty field → the browser asks you to fill it.
- [ ] Submit a valid booking → confirmation card with REQ ID, details and "Estimated Arrival: 15 mins (typical response estimate — not based on live location…)".
- [ ] Refresh the confirmation page → it still shows the booking.
- [ ] Home shows "Your Active Booking Status" with "New", Unassigned Driver and Unassigned Ambulance.

### Admin (browser 2)
- [ ] Log in as admin → admin dashboard; the overview numbers match.
- [ ] The booking from browser 1 is in Requests with the user's name.
- [ ] Add an ambulance (e.g. A104). Adding A104 again shows an error.
- [ ] Add a driver (name, email, temporary password).
- [ ] The A103 (maintenance) option is disabled in the dropdown.
- [ ] Click Assign with only an ambulance chosen → "Please select both an ambulance and a driver."
- [ ] Assign an ambulance and driver → success message; the row shows Pending, and the ambulance and driver show "assigned".
- [ ] Within about 5 s, browser 1's Home card shows Pending, the driver name/phone and the ambulance.
- [ ] Click En route with an empty ETA → the ETA error message appears. Enter 10 and click En route → badge shows "En route".
- [ ] Browser 1 shows "ETA to Pickup: 10 mins (reported by dispatcher at HH:MM, expected around HH:MM — not live GPS)".
- [ ] Update ETA to 7 → browser 1 updates.
- [ ] Try "Maintenance" or "Delete" on the assigned ambulance → the buttons are disabled.

### Driver (log in as the new driver in browser 2, or a 3rd browser)
- [ ] Login → driver dashboard showing the assignment, the patient name and the ambulance code.
- [ ] Arrived → Complete; the buttons enable in order and the badge updates.
- [ ] Admin dashboard: the ambulance and driver are "available" again.

### Feedback (browser 1)
- [ ] Home shows "Your last service is complete! Please submit your feedback."
- [ ] Log out and back in → you are taken straight to the feedback form.
- [ ] Submit without a rating → the browser asks for one. Choose 5 and add a comment → "Thank you for your feedback! Rating: 5/5".
- [ ] My Bookings shows 5/5. Opening `/feedback/<id>` again says feedback was already submitted.
- [ ] Admin: the Feedback table shows the comment, the Requests table shows 5/5 and the average rating updates.

### Security spot checks
- [ ] As a user, open `/admin` → "This page is not available for your account type (user)."
- [ ] In DevTools → Application → Cookies: `asm_token` is marked HttpOnly. In Local Storage there are no `asm_*` keys from the new app.
- [ ] Stop the API server and click around → clear error messages with Retry, and no fake data.
- [ ] Restart the API and click Retry → data comes back.
- [ ] Wait for the session to expire (or delete the cookie) and click something → "Your session has expired. Please log in again."

### Concurrency (optional)
- [ ] Open the admin dashboard in two browsers. Assign the **same** ambulance to two different new bookings at nearly the same time → one succeeds and the other shows "Ambulance … is not available".
