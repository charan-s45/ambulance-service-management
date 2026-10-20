// An error we expect and want to show to the client with a specific HTTP status.
// Anything else that is thrown becomes a generic 500 response.
export class AppError extends Error {
  constructor(status, message, code = "ERROR", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(400, msg, "VALIDATION_ERROR", details);
export const unauthorized = (msg = "Please log in to continue.") =>
  new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "You do not have permission to do this.") =>
  new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found.") => new AppError(404, msg, "NOT_FOUND");
export const conflict = (msg) => new AppError(409, msg, "CONFLICT");
