import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}`, code: "NOT_FOUND" } });
}

// Every error ends up here and is turned into the same JSON shape:
// { error: { message, code, details? } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { message: "Request body is not valid JSON.", code: "BAD_JSON" } });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: { message: "Request body is too large.", code: "TOO_LARGE" } });
  }
  // Duplicate key from a unique index (e.g. same email registered twice at once)
  if (err.code === 11000) {
    return res.status(409).json({ error: { message: "That record already exists.", code: "CONFLICT" } });
  }
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ error: { message: "Invalid data.", code: "VALIDATION_ERROR" } });
  }

  if (!config.isTest) console.error(err);
  res.status(500).json({
    error: {
      message: "Something went wrong on the server. Please try again.",
      code: "SERVER_ERROR",
      // Stack traces are only included during local development.
      ...(config.env === "development" ? { stack: err.stack } : {}),
    },
  });
}
