import { forbidden } from "../utils/AppError.js";

// CSRF protection for cookie-based auth ("custom request header" pattern).
// Browsers will not let another website add a custom header to a cross-site
// request without passing our CORS check first, so requiring this header on
// every state-changing request blocks forged form posts and image tags.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireCsrfHeader(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    throw forbidden("Missing request header. Please use the application to make changes.");
  }
  next();
}
