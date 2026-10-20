# Audit of the original prototype & feature-preservation checklist

## 1. What the original was

`legacy/website.html` was one 1,380-line HTML file with inline CSS and JavaScript.

- **Pages:** each "page" was a `<section>`, shown and hidden by `showSection(id)`.
- **Data:** everything was stored in the browser's `localStorage` under five keys.
  Every browser therefore had its **own separate copy** of all users, bookings
  and ambulances, so an admin on another computer could never see a user's booking.

| Old localStorage key | Contents | Now stored in |
|---|---|---|
| `asm_users_v1` | users incl. **plain-text passwords** and role | `users` collection (bcrypt hashes) + `drivers` collection |
| `asm_reqs_v1` | ambulance requests | `bookings` collection |
| `asm_ambs_v1` | ambulances | `ambulances` collection |
| `asm_feedback_v1` | feedback | `feedback` collection |
| `asm_current_v1` | the logged-in user object (role editable in DevTools) | HttpOnly JWT cookie, user re-loaded from DB each request |

The new React app makes **no** use of `localStorage`, `sessionStorage` or IndexedDB
(`grep -r localStorage client/src` only matches a code comment saying so).

## 2. Feature-preservation checklist

✅ = preserved (same behaviour). 🔧 = preserved with a fix or security change, explained in the notes.

| # | Original feature | Where it lives now | Status |
|---|---|---|---|
| 1 | Navbar: Home, About, Services, Contact | `components/Navbar.jsx` | ✅ |
| 2 | Navbar: Dashboard + Logout when logged in, Login/SignUp when not | `Navbar.jsx` | 🔧 the Dashboard link was broken HTML (missing `<a`), which crashed the page script on load |
| 3 | Navigation on small screens | `Navbar.jsx` + CSS | 🔧 links were hidden < 900 px with no alternative; now a ☰ menu button |
| 4 | Home hero: "Every second counts…" + 3 counters | `pages/Home.jsx`, `GET /stats/public` | ✅ now real shared numbers, refreshed every 15 s |
| 5 | Quick actions: Book / View Services / Contact | `Home.jsx` | ✅ |
| 6 | "Your Active Booking Status" card (ID, badge, ETA, driver, ambulance, pickup, destination), refresh every 5 s | `components/BookingTrackingCard.jsx` | 🔧 the old code started a new timer on every render; now one timer, paused in hidden tabs |
| 7 | Home card prompting feedback for a completed booking | `BookingTrackingCard.jsx` | ✅ |
| 8 | About text | `pages/StaticPages.jsx` | ✅ word-for-word |
| 9 | Services: 4 cards with icons, hover lift | `StaticPages.jsx` | ✅ |
| 10 | Contact card | `StaticPages.jsx` | ✅ (fixed-size box made responsive) |
| 11 | Login with email + password | `pages/Login.jsx`, `POST /auth/login` | 🔧 the role dropdown did nothing (the role came from the stored user). It is now three login choices (User / Driver / Admin); the server checks the choice matches the account and refuses otherwise. Each leads to its own dashboard (users now also have a User Dashboard at `/dashboard`) |
| 12 | Post-login redirect: admin → admin dashboard, driver → driver dashboard, user → feedback form if one is owed, else booking form | `Login.jsx` | ✅ same rules |
| 13 | "Welcome, name (role)" message | flash banner | ✅ (was `alert()`) |
| 14 | Register with email + password; name = part before "@" | `pages/Register.jsx`, `POST /auth/register` | 🔧 the role dropdown became separate User / Driver / Admin register forms. User sign-up is unchanged. Drivers also give name, phone and licence. **Admin sign-up requires the secret `ADMIN_REGISTRATION_CODE`** (in the prototype anyone could become an admin) |
| 15 | Duplicate email message "User with this email already exists. Please login." | API 409 | ✅ |
| 16 | Logout | `POST /auth/logout` | ✅ |
| 17 | Booking form: pickup, destination, date, time; must be logged in as a User (otherwise message + go to login) | `pages/BookAmbulance.jsx`, `POST /bookings` | ✅ |
| 18 | Booking ID format `REQ######` | server `utils/ids.js` | ✅ now generated server-side with a secure random source + unique index |
| 19 | Confirmation card (ID, pickup, destination, scheduled, ETA, "Go to Home & Status") | `pages/BookingConfirmation.jsx` | ✅ also works after a page refresh |
| 20 | ETA on new bookings | `EtaDisplay.jsx` | 🔧 was a **random 9–24** presented as an estimate; now a configurable default labelled as not live |
| 21 | Feedback form: rating 1–5 (required) + optional comments, only for own completed booking, only once | `pages/Feedback.jsx`, `POST /feedback` | ✅ enforced on the server + unique index |
| 22 | "Thank you for your feedback! Rating: X/5" | flash banner | ✅ |
| 23 | Admin overview: active requests, available ambulances, total drivers | `AdminDashboard.jsx`, `GET /stats/admin` | ✅ (+ awaiting assignment, completed, users, average rating) |
| 24 | Admin requests table: ID, Pickup, Destination, When, Status, Ambulance, Driver, Feedback, Actions | `components/admin/RequestsTable.jsx` | ✅ same columns |
| 25 | Admin: choose ambulance + driver and Assign | `RequestsTable.jsx`, `POST /bookings/:id/assign` | 🔧 both are required together; unavailable ones are shown but disabled; "force assign" of an unavailable ambulance was removed (see §4) |
| 26 | Admin: ETA box + En route / Arrived / Complete | `components/StatusActions.jsx` | 🔧 the order is now enforced; invalid next steps are disabled |
| 27 | Rule: ETA must be > 0 before "En route" (message text kept) | client + server | ✅ now also applies to drivers |
| 28 | Completing a booking frees the ambulance | `bookingService.changeStatus` | ✅ (+ frees the driver) |
| 29 | Admin ambulances table: ID, Vehicle, Status | `AmbulancesPanel.jsx` | ✅ (+ registration no., current booking) |
| 30 | Driver dashboard: own assignments with En route / Arrived / Complete | `pages/DriverDashboard.jsx` | ✅ (+ ETA box, patient name/phone, refresh every 10 s) |
| 31 | Driver may only update their own assignments | server `assertCanOperate` | ✅ now enforced on the server |
| 32 | Status badges New / Pending / En route / Arrived / Completed with the same colours | `StatusBadge.jsx` + CSS | ✅ |
| 33 | Footer with current year | `Footer.jsx` | ✅ (was blank because of the page crash, item 2) |
| 34 | Theme: teal `#1a919c`, Cambria font, background photo, cards, shadows | `styles/app.css` | ✅ CSS ported almost verbatim |
| 35 | Sample data (A101, A102, A103-maintenance; demo driver/user) | `npm run seed` | 🔧 development only; random passwords instead of `admin123` etc.; no demo admin |
| 36 | Unused functions `prefillDefaults`, `showRegister`, `showLogin` | – | removed: they were never called and contained the demo admin password |

### New features (from the upgrade brief)

- **My Bookings** page: booking history with status, ETA, ambulance, driver and feedback.
- **Ambulances:** add, edit, set maintenance/available, delete (blocked while on a job).
- **Drivers:** add (creates login), edit, off-duty/available, delete (blocked while on a job).
- **Admin views:** registered users table and feedback table with comments.
- **"Update ETA"** for admin and driver while pending or en route.
- **Status history** stored per booking, with timestamps.
- **Concurrency-safe assignment** with automatic rollback.
- Optional **legacy import** script.
- Loading, empty and error states with **Retry** everywhere data is loaded.

## 3. Bugs found in the original (all fixed)

1. **Page crash on load:** `<a` was missing on the Dashboard link, so
   `document.getElementById("nav-dashboard")` was `null` and `updateNav()` threw.
   As a result, counters, admin tables and the footer year were never filled.
2. Passwords were stored in plain text, and **anyone could register as an admin**.
3. The login role dropdown was ignored.
4. There were no status-transition rules: New → Completed directly was possible,
   and drivers could set En route without an ETA.
5. A driver could be assigned to any number of simultaneous bookings, and an
   ambulance in maintenance could be force-assigned.
6. The ETA was a random number shown as an estimate.
7. The tracking card started a new `setTimeout` on every render, so timers accumulated.
8. User-typed text was inserted with `innerHTML` unescaped on the confirmation
   and tracking cards (XSS). React escapes all output now.
9. There was no navigation at all on screens below 900 px, and fixed card sizes
   (`min-width: 450px`, `width: 600px; height: 350px`) broke small screens.
10. The admin's "Complete" button opened the *user's* feedback form when the admin
    happened to own the booking (`req.userEmail === currentUser?.email`). That
    branch was meaningless and was removed.

## 4. Intentional behaviour changes (and why)

| Change | Reason |
|---|---|
| Public registration can only create `user` accounts | Prevents anyone from becoming an admin or driver |
| Admin and driver accounts are created by the CLI or by an admin | Secure bootstrap of the first admin |
| Assign needs both an ambulance **and** a driver | A booking can't progress without both; keeps availability consistent |
| No "force assign" of unavailable ambulances | The brief requires that unavailable resources cannot be assigned. Put the ambulance back to "available" first if it is really usable |
| Strict status order | The brief requires enforced valid transitions |
| ETA is cleared at "Arrived" | An arrival estimate is meaningless once the ambulance has arrived |
| Ambulance status `pending` renamed `assigned` | Internal value only. The old name was confusing next to the booking status "pending". Booking status names are unchanged |
| No "Cancelled" status | The prototype had no cancellation feature, and the brief says to add one only if it existed. Easy to add later (new status + endpoint that releases resources) |
| `alert()` pop-ups replaced by an in-page message banner | Same messages, but they no longer block the page |
