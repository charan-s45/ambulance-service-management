import { badRequest } from "../utils/AppError.js";

// Validates req.body against a zod schema and REPLACES it with the parsed
// result. Schemas are .strict(), so unknown fields (e.g. "role": "admin")
// are rejected instead of being silently saved — this prevents mass assignment.
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join(".") || null,
        message: i.message,
      }));
      throw badRequest(details[0]?.message || "Invalid request.", details);
    }
    req.body = result.data;
    next();
  };
}
