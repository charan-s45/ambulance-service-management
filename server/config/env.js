// Reads configuration from environment variables in one place, so the rest of
// the code never touches process.env directly.

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be a whole number`);
  return n;
}

export function loadConfig() {
  const jwtSecret = isTest
    ? process.env.JWT_SECRET || "test-only-secret-not-for-real-use-0123456789"
    : required("JWT_SECRET");

  if (!isTest && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }

  return {
    env: NODE_ENV,
    isProduction,
    isTest,
    port: intFromEnv("PORT", 5000),
    mongoUri: isTest ? process.env.MONGODB_URI || "" : required("MONGODB_URI"),
    // Comma-separated list of front-end origins allowed to call the API.
    // On Render, the service's own public URL is added automatically.
    clientUrls: [
      ...(process.env.CLIENT_URL || "http://localhost:5173").split(","),
      process.env.RENDER_EXTERNAL_URL || "",
    ]
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
    // "lax" works when the API and the React app share a site (same domain,
    // or localhost in development). Use "none" only for cross-site hosting.
    cookieSameSite: (process.env.COOKIE_SAMESITE || "lax").toLowerCase(),
    // Minutes shown to the user before a dispatcher/driver gives a real ETA.
    defaultEtaMinutes: intFromEnv("DEFAULT_ETA_MINUTES", 15),
    // Secret code required to register an admin on the website. Empty = admin
    // self-registration is switched off (use npm run create-admin instead).
    adminRegistrationCode: process.env.ADMIN_REGISTRATION_CODE || "",
    serveClient: process.env.SERVE_CLIENT === "true",
    trustProxy: intFromEnv("TRUST_PROXY", 0),
  };
}

export const config = loadConfig();
