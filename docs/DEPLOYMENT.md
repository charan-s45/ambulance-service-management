# Deployment

## Quick path: free public link (GitHub + MongoDB Atlas + Render)

1. **MongoDB Atlas** (https://www.mongodb.com/cloud/atlas/register):
   1. Create a free **M0** cluster.
   2. In **Database Access**, add a user with an auto-generated password.
   3. In **Network Access**, add `0.0.0.0/0`. Render's free tier has no fixed IP;
      keep the database password strong.
   4. Click **Connect → Drivers** and copy the `mongodb+srv://…` string. Put your
      password in it and add `/ambulance_service` before the `?`.
2. **Push this folder to a GitHub repository.**
3. **Render** (https://render.com, sign in with GitHub):
   1. Go to **New → Blueprint** and pick the repository. Render reads [`render.yaml`](../render.yaml).
   2. Paste `MONGODB_URI` and choose an `ADMIN_REGISTRATION_CODE`.
   3. Click **Apply**. The first build takes about 3–5 minutes.
   4. Your link is `https://ambulance-service-XXXX.onrender.com`.
4. Open the link, choose **Admin**, and **Register as Admin** with your code.
   Add ambulances, and you're live.

Free-tier notes:
- Render's free service **sleeps after 15 minutes without visitors**. The next
  visit takes about 30–60 seconds to wake it, so mention this if you share the link.
- Atlas M0 has 512 MB of storage, which is plenty for a demo.

## Recommended: one service serves both API and React app

Same origin = the simplest and safest cookie setup (`SameSite=Lax`, no
cross-site cookies, no CORS issues). Works on Render, Railway, Fly.io, a VPS, etc.

1. **MongoDB Atlas**
   1. Create a cluster.
   2. Create a database user with a strong, unique password and the
      `readWrite` role on `ambulance_service`.
   3. Under Network Access, allow your host's outbound IPs. `0.0.0.0/0` only
      works together with a strong password; prefer IP allow-listing or
      private networking where your host supports it.
   4. Enable **backups** (continuous or snapshot) on the cluster.
2. **Build and start commands** (from the repository root):
   - Build: `npm run install:all && npm run build`
   - Start: `npm start` (runs `node server.js`; it reads `server/.env` if present, otherwise the platform's environment variables)
3. **Environment variables** on the host:

   | Variable | Production value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas `mongodb+srv://...` string |
   | `JWT_SECRET` | New random 48+ byte hex string. **Never reuse the development one.** |
   | `CLIENT_URL` | Your public URL, e.g. `https://ambulance.example.org` |
   | `SERVE_CLIENT` | `true` |
   | `COOKIE_SAMESITE` | `lax` |
   | `TRUST_PROXY` | `1` (behind the platform's load balancer, needed for correct rate limiting by client IP) |
   | `PORT` | Usually set by the platform |
   | `DEFAULT_ETA_MINUTES` | Your organisation's typical response time |
   | `ADMIN_REGISTRATION_CODE` | **Empty** (recommended: create admins with `npm run create-admin`), or a long random secret shared only with future admins |

4. **HTTPS is required.** In production the cookie is `Secure`, so login will not
   work over plain HTTP. Hosting platforms provide HTTPS automatically. On a VPS, put
   Nginx/Caddy with a certificate in front of the app.
5. **Create the first admin** once, from a shell with the production variables:
   `cd server && npm run create-admin -- --email you@org --name "You"`.
   Do **not** run `npm run seed` in production; it refuses to anyway.

## Alternative: front end and API on different domains

For example, React on Vercel/Netlify and the API on Render.

- **Client:** build with `VITE_API_URL=https://your-api.example.com`.
- **Server:** set `CLIENT_URL=https://your-frontend.example.com` (exact origin, no
  trailing slash) and `COOKIE_SAMESITE=none` (requires HTTPS; `Secure` is then forced).
- With `SameSite=None`, the browser sends the cookie on cross-site requests. CSRF
  protection then relies on the required `X-Requested-With` header plus the CORS
  allow-list. These are both in place, but this setup has more moving parts.
  Some browsers block third-party cookies entirely, which breaks login. **Prefer
  hosting both under one domain** (e.g. `app.example.org` and `api.example.org`
  are the *same site*, so `lax` still works).
- Configure the static host to rewrite all routes to `index.html` (SPA fallback).

## Verifying a deployment

```bash
curl https://YOUR_HOST/api/health          # {"data":{"status":"ok"}}
curl https://YOUR_HOST/api/stats/public    # counters JSON
```

Then run the manual checklist in [TESTING.md](TESTING.md) against the live site.

## Logs & common errors

The server logs `MongoDB connected: …` and `API listening on …` at start-up.
Unexpected errors are logged with a stack trace on the server only; clients
receive a generic message.

| Symptom | Likely cause / fix |
|---|---|
| Process exits with `Missing required environment variable: …` | Set that variable on the host |
| `JWT_SECRET must be at least 32 characters long` | Generate a proper secret |
| `MongoServerSelectionError` / timeout | Wrong `MONGODB_URI`, Atlas IP allow-list, or wrong password (URL-encode special characters) |
| Login succeeds but the next request is 401 | Cookie not stored: site served over HTTP in production, or cross-domain without `COOKIE_SAMESITE=none` + HTTPS |
| Browser console: CORS error | `CLIENT_URL` doesn't exactly match the front-end origin (scheme + host + port) |
| 403 "Missing request header" | A custom client isn't sending `X-Requested-With: XMLHttpRequest` |
| Everyone gets 429 quickly | Behind a proxy without `TRUST_PROXY=1` (all users appear as one IP) |
| Blank page on deep links like `/admin` | SPA fallback missing (`SERVE_CLIENT=true`, or static-host rewrite rule) |

## Known limitations & what is still needed for real-world dispatch

This is a working, tested application, but it is **not yet production-ready for
real emergency dispatch**.

- **No live location, maps or routing.** The ETA is a configurable default or a
  number a person types in. Real ETAs would need driver GPS (a mobile app or
  telematics) and a routing API (Google Maps, Mapbox, OSRM), plus their keys and costs.
- **This is not an emergency line.** There is no telephony, SMS or push
  notification. Users must still call the local emergency number for
  life-threatening situations; consider showing that prominently.
- **Polling, not push.** Status refreshes every 5–10 s. WebSockets or SSE would be
  needed for instant updates at scale.
- **Crash window during assignment.** If the server process dies *between* claiming
  a resource and saving the booking, that ambulance or driver can stay "assigned".
  An admin cannot currently fix this from the UI. A small "reconcile" job, or using
  MongoDB transactions (replica set or Atlas), would close this gap.
- **No cancellation, password reset, email verification or account self-service.**
  The prototype had none of these.
- **Sessions:** 8-hour JWTs with no server-side revocation list. Logging out
  clears the cookie, but a stolen token stays valid until it expires. Add a token
  version or session store if needed.
- **Lists are capped** (500 bookings and feedback, 1,000 users); pagination is
  needed for large deployments.
- **Operational work not done:** monitoring and alerting (uptime checks on
  `/api/health`, error tracking such as Sentry), centralised logs, regular
  **backup restore drills**, a recovery plan, load testing, an accessibility audit,
  and privacy/medical-data compliance review (patient addresses and phone numbers
  are personal data).
- **External assets:** the background photo (`t3.ftcdn.net`, a stock-image
  preview), the logo (`flaticon`), Google Fonts and Font Awesome are loaded from
  third-party servers, as in the prototype. For production, licence the images
  and host them yourself.
