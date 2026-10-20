import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { User } from "../models/User.js";
import { unauthorized, forbidden } from "../utils/AppError.js";

export const AUTH_COOKIE = "asm_token";

export function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the browser cannot read the token
    secure: config.isProduction || config.cookieSameSite === "none",
    sameSite: config.cookieSameSite,
    path: "/",
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Reads the JWT from the HttpOnly cookie, verifies it and loads the user from
// MongoDB. The role always comes from the database, never from the client.
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized("Your session has expired. Please log in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized("Your account no longer exists.");

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
