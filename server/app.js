import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { config } from "./config/env.js";
import { requireCsrfHeader } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import ambulanceRoutes from "./routes/ambulanceRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tooMany = (message) => ({
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { message, code: "RATE_LIMITED" } },
});

/**
 * Builds the Express app without starting it, so tests can use it directly.
 * `limits` lets tests tighten or loosen rate limits.
 */
export function createApp({ limits = {} } = {}) {
  const app = express();

  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(helmet()); // secure HTTP headers
  app.use(
    cors({
      origin: config.clientUrls, // only our front end may call the API from a browser
      credentials: true, // allow the auth cookie
    }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  // General limit for the whole API, stricter limit for login/register.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: limits.api ?? (config.isTest ? 10000 : 300),
    ...tooMany("Too many requests. Please slow down."),
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: limits.auth ?? (config.isTest ? 10000 : 20),
    ...tooMany("Too many login attempts. Please wait 15 minutes and try again."),
  });

  app.use("/api", apiLimiter, requireCsrfHeader);

  app.get("/api/health", (_req, res) => res.json({ data: { status: "ok" } }));
  app.use("/api/auth", authRoutes({ authLimiter }));
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/ambulances", ambulanceRoutes);
  app.use("/api/drivers", driverRoutes);
  app.use("/api/feedback", feedbackRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api", notFoundHandler);

  // Optional: serve the built React app from the same server (same origin =
  // simplest and safest cookie setup in production).
  if (config.serveClient) {
    const dist = path.resolve(__dirname, "../client/dist");
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
