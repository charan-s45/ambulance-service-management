import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validators/schemas.js";

export function authRoutes({ authLimiter }) {
  const r = Router();
  r.post("/register", authLimiter, validateBody(registerSchema), auth.register);
  r.post("/login", authLimiter, validateBody(loginSchema), auth.login);
  r.post("/logout", auth.logout);
  r.get("/me", requireAuth, auth.me);
  return r;
}
