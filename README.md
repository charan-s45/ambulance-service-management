# Ambulance Service Management System (MERN)

This is a full-stack upgrade of the original single-file prototype (`legacy/website.html`).
The pages, colours and workflows are the same as before. The difference is that
data now lives in a shared **MongoDB** database behind a secure **Express** API,
instead of in each browser's `localStorage`.

| Part | Technology | Folder |
|---|---|---|
| Front end | React 19 + React Router + Vite | [`client/`](client/) |
| Back end | Node.js + Express 5 | [`server/`](server/) |
| Database | MongoDB + Mongoose | (external, local or Atlas) |
| Auth | bcrypt-hashed passwords, JWT in an HttpOnly cookie, role checks on every API route | `server/middleware/auth.js` |

More documentation:

- [docs/AUDIT-AND-FEATURES.md](docs/AUDIT-AND-FEATURES.md): audit of the old app, the feature-preservation checklist, bugs fixed and intentional changes.
- [docs/API.md](docs/API.md): every endpoint, who may call it, and the request/response shapes.
- [docs/TESTING.md](docs/TESTING.md): automated test results and a manual test checklist.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Atlas, hosting, production settings, troubleshooting and known limitations.

---

## 1. How the pieces talk to each other

```
 Browser (React)                Express API (Node.js)                 MongoDB
 ─────────────────             ───────────────────────               ──────────
 BookAmbulance.jsx  ──fetch──▶ POST /api/bookings
   api.post(...)               1. requireAuth: read cookie, verify JWT,
                                  load user from DB
                               2. requireRole("user")
                               3. validateBody(schema): reject bad input
                               4. bookingService.createBooking() ──▶  bookings collection
                    ◀──JSON─── { data: {...}, message: "Booking Confirmed!" }
```

- **React never talks to MongoDB.** Every request goes through
  `client/src/api/apiClient.js`. That file sends the login cookie, adds the CSRF
  header and turns errors into readable messages.
- **Express** checks *who* you are (cookie → JWT → user loaded from the
  database) and *what you are allowed to do* (role and ownership checks). It
  validates the input and then reads or writes MongoDB through **Mongoose models**
  (`server/models/*.js`).
- Responses always have the same shape: `{ data, message? }` on success, or
  `{ error: { message, code, details? } }` on failure.

## 2. Folder structure

```
Ambulanceservicesystem/
├── legacy/website.html        Original prototype (kept for reference, unchanged)
├── client/                    React app
│   ├── index.html             Loads fonts/icons and mounts React
│   ├── vite.config.js         Dev server + proxy of /api → Express (:5000)
│   └── src/
│       ├── api/apiClient.js   The single place that calls the API
│       ├── context/           AuthContext (logged-in user), FlashContext (messages)
│       ├── hooks/useApiData.js  Load + poll data (one timer, pauses in background tabs)
│       ├── components/        Navbar, Footer, StatusBadge, EtaDisplay, StatusActions,
│       │   └── admin/         RequestsTable, AmbulancesPanel, DriversPanel, ListTables
│       ├── pages/             Home, About/Services/Contact, Login, Register, BookAmbulance,
│       │                      BookingConfirmation, BookingHistory, Feedback,
│       │                      AdminDashboard, DriverDashboard
│       ├── styles/app.css     The original CSS, ported (fixes/additions are labelled)
│       └── test/              Vitest + Testing Library tests
├── server/                    Express API
│   ├── server.js              Starts the app: connect DB → listen
│   ├── app.js                 Builds the Express app (middleware + routes)
│   ├── config/                env.js (settings), db.js (Mongo connection)
│   ├── models/                User, Driver, Ambulance, Booking, Feedback
│   ├── middleware/            auth, csrf, validate, errorHandler
│   ├── validators/schemas.js  What each request body may contain (zod)
│   ├── services/bookingService.js  Booking, assignment, status and ETA rules
│   ├── controllers/           One file per resource; turns HTTP into service calls
│   ├── routes/                URL → middleware → controller
│   ├── scripts/               create-admin, seed (demo data), import-legacy
│   ├── utils/                 AppError, ID helpers
│   └── tests/                 node:test + supertest + in-memory MongoDB
├── docs/                      Documentation (see above)
└── package.json               Convenience scripts for both projects
```

## 3. Setup from a clean machine

**Prerequisites:** Node.js 20.12 or newer (tested with Node 24), npm, and a MongoDB database.

### 3.1 MongoDB

Pick **one** option:

- **Local:** install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
  and start it. The connection string is `mongodb://127.0.0.1:27017/ambulance_service`.
- **MongoDB Atlas (free tier):**
  1. Create a cluster.
  2. Under **Database Access**, add a user with a strong password.
  3. Under **Network Access**, allow your IP address.
  4. Click **Connect → Drivers** and copy the `mongodb+srv://...` string. Add
     the database name before the `?`, e.g. `...mongodb.net/ambulance_service?retryWrites=true&w=majority`.

A standalone MongoDB server is enough. The app does **not** need a replica set
or multi-document transactions (see "Assignment safety" below).

### 3.2 Install

```bash
npm run install:all          # same as: npm install in server/ and in client/
```

### 3.3 Configure the server

```bash
cd server
cp .env.example .env         # Windows PowerShell: Copy-Item .env.example .env
```

Edit `server/.env`:

| Variable | What to put |
|---|---|
| `MONGODB_URI` | Your local or Atlas connection string |
| `JWT_SECRET` | A long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `http://localhost:5173` in development |
| `PORT` | `5000` |
| `NODE_ENV` | `development` |
| `DEFAULT_ETA_MINUTES` | Typical response time shown before a real ETA is entered (default 15) |

The client needs no `.env` in development. The Vite dev server forwards `/api` to `localhost:5000`.

### 3.4 Create the first administrator

There are two ways:

- **On the website:** set `ADMIN_REGISTRATION_CODE` in `server/.env` to a secret
  value. Then choose **Admin** on the login page, fill in **Register as Admin**
  and type that code. If the variable is empty, admin sign-up on the website is
  switched off. In the old prototype anyone could register as an admin; the code
  prevents that.
- **From the command line** (works even when website sign-up is off):

```bash
cd server
npm run create-admin -- --email admin@yourorg.com --name "Your Name"
# You will be asked for a password (min. 8 characters).
```

### 3.5 (Optional) demo data

```bash
npm run seed
```

This adds ambulances A101, A102 and A103 (A103 in maintenance), as in the
prototype, plus a demo driver and a demo user. Their **random passwords are
printed once**. The script refuses to run when `NODE_ENV=production`.

### 3.6 Run

**One command** (from the project root):

```bash
npm run dev
```

This starts MongoDB (only if nothing is already listening on port 27017 and
`dev.config.json` says where `mongod.exe` is), the API and the React app
together. Press Ctrl+C to stop all three. `dev.config.json` is machine-specific
and not committed. Example:

```json
{ "mongodPath": "D:/asm-tooling/mongodb-binaries/mongod-x64-win32-8.2.6.exe",
  "dbPath": "D:/asm-tooling/mongodb-data", "mongoPort": 27017 }
```

Leave the file out if you run MongoDB yourself or use Atlas. MongoDB's own log
is written to `mongod.log` next to the data folder.

**Or** use two terminals:

```bash
npm run dev:server     # API on http://localhost:5000 (restarts on file changes)
npm run dev:client     # React on http://localhost:5173  ← open this one
```

Log in as the admin and add ambulances and drivers on the dashboard. Then register
a normal user in another browser (or a private window) and make a booking.

## 4. Roles, logins and dashboards

The login page has three choices: **User**, **Driver** and **Admin** (direct
links: `/login`, `/login?as=driver`, `/login?as=admin`). Each one leads to its
own dashboard. The choice is checked against the account on the server, so
picking "Admin" with a user account is refused. Each choice also has its own
Register form: User (email and password), Driver (adds name, phone and licence)
and Admin (needs the `ADMIN_REGISTRATION_CODE`).

| Role | How the account is created | Can do |
|---|---|---|
| **user** | Public registration form | **User Dashboard** (`/dashboard`): live status of the active booking, counts, recent bookings; book, see all bookings, give feedback |
| **driver** | "Register as Driver" on the login page, or Admin → Drivers → "Add driver" | **Driver Dashboard** (`/driver`): see own assignments; set En route (with ETA), Arrived, Complete; update ETA |
| **admin** | "Register as Admin" with the secret `ADMIN_REGISTRATION_CODE`, or `npm run create-admin` | **Admin Dashboard** (`/admin`): everything: all bookings, assign ambulance and driver, status/ETA, manage ambulances and drivers, see users, feedback and statistics |

### Driver profile vs. user account

A driver logs in with a normal **User** document (`role: "driver"`), which holds
the name, email, phone and password hash. A separate **Driver** document links to
it (`Driver.user`) and stores operational data: licence number, availability and
current booking. "Add driver" creates both in one step, and "Delete driver" removes both.

## 5. Booking lifecycle (same status names as the prototype)

```
new ──(admin assigns ambulance + driver)──▶ pending ──(ETA required)──▶ enroute ──▶ arrived ──▶ completed
```

- The server enforces this order. Skipping or going backwards returns
  **409 Conflict**.
- On **assign**, the ambulance and driver become `assigned`. On **completed**,
  both become `available` again.
- **ETA:** a new booking shows the configurable default, labelled *"typical
  response estimate — not based on live location"*. When an admin or driver
  enters minutes, the UI shows who reported it, at what time, and the expected
  clock time. **There is no GPS or map integration.**
- The user's Home page refreshes the status every 5 seconds. Dashboards refresh
  every 10 seconds.

### Assignment safety (concurrency)

Two admins might click "Assign" for the same ambulance at the same moment. The
server prevents a double assignment like this:

1. It claims the ambulance with a **single atomic MongoDB update** whose filter
   requires `status: "available"`. Only one request can match, and the other
   gets *409: not available*.
2. It claims the driver the same way.
3. It updates the booking only if the booking hasn't changed since it was read.
4. If any step fails, the resources already claimed are **released again**, so a
   failed assignment never leaves an ambulance or driver stuck as "assigned".

This works on any MongoDB deployment, including a standalone server. MongoDB
transactions (which need a replica set; Atlas always has one) are not required.
There is one remaining gap: if the server process crashes in the middle of step 1–3,
a resource could stay "assigned". See the known limitations in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 6. Security summary

- Passwords are hashed with **bcrypt** (12 rounds, `bcryptjs`: the same
  algorithm in pure JavaScript, so there is no native build step on Windows).
  Hashes are never returned by the API.
- Login state is a JWT in an **HttpOnly** cookie (JavaScript cannot read it),
  `SameSite=Lax`, and `Secure` in production. It expires after `JWT_EXPIRES_IN`
  (8 h by default). There are no refresh tokens: the user simply logs in again,
  and the React app redirects them with a "session expired" message. Nothing
  about the login is stored in `localStorage`.
- The role is **always read from the database** on every request. Nothing the
  browser sends can change it.
- **CSRF protection:** state-changing requests must carry the
  `X-Requested-With: XMLHttpRequest` header (other sites cannot add it), plus SameSite cookies.
- **Validation:** strict zod schemas reject unknown fields, which also prevents
  mass assignment (e.g. sending `"role": "admin"` or `"status": "completed"`).
- **Authorization:** users can only read their own bookings (other users' bookings return 404),
  drivers only their assigned ones, and admin routes require the admin role.
- **Other protections:** `helmet` security headers, a CORS allow-list (`CLIENT_URL`),
  rate limits (20 login/register attempts per 15 min per IP, 300 API requests per
  min), a 20 kB body limit, and no stack traces in production error responses.

## 7. Scripts

| Where | Command | Purpose |
|---|---|---|
| root | `npm run install:all` | Install both projects |
| root | `npm test` | Run server and client tests |
| root | `npm run build` | Build the React app into `client/dist` |
| root | `npm start` | Start the API in production mode (reads `server/.env`) |
| server | `npm run dev` | API with auto-restart |
| server | `npm run create-admin -- --email … [--name …] [--promote]` | Create/promote an admin |
| server | `npm run seed` | Demo ambulances/accounts (development only) |
| server | `npm run import-legacy -- export.json [--apply]` | Optional import of old localStorage data (see the comments at the top of `server/scripts/importLegacy.js`) |
