import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { AUTH_COOKIE, cookieOptions, signToken } from "../middleware/auth.js";
import { AppError } from "../utils/AppError.js";
import { assertAdminCode, createDriverAccount, createUserAccount } from "../services/accountService.js";

export { hashPassword } from "../services/accountService.js";

// Used to make "unknown email" take as long as "wrong password", so attackers
// cannot discover which emails are registered by timing the response.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-password", 12);

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, phone: user.phone };
}

// POST /api/auth/register
// - user:   open to everyone
// - driver: open to everyone; also creates the driver profile (starts "available")
// - admin:  only with the secret ADMIN_REGISTRATION_CODE from the server's .env
export async function register(req, res) {
  const { role, adminCode, licenseNumber, ...fields } = req.body;
  let user;
  if (role === "driver") {
    ({ user } = await createDriverAccount({ ...fields, licenseNumber }));
  } else if (role === "admin") {
    assertAdminCode(adminCode);
    user = await createUserAccount({ ...fields, role: "admin" });
  } else {
    user = await createUserAccount({ ...fields, role: "user" });
  }
  res.status(201).json({ data: publicUser(user), message: REGISTERED_MESSAGE[role] });
}

const REGISTERED_MESSAGE = {
  user: "Account created. You can now login.",
  driver: "Driver account created. You can now login with the Driver login.",
  admin: "Admin account created. You can now login with the Admin login.",
};

// POST /api/auth/login
export async function login(req, res) {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    // One generic message for both cases (does not reveal which emails exist).
    throw new AppError(401, "Incorrect email or password.", "INVALID_CREDENTIALS");
  }
  // Checked only after the password is correct, so it reveals nothing to strangers.
  if (role && role !== user.role) {
    throw new AppError(
      403,
      `This is not a${role === "admin" ? "n" : ""} ${role} account. Please choose the "${user.role}" login.`,
      "WRONG_LOGIN_TYPE",
    );
  }
  res.cookie(AUTH_COOKIE, signToken(user), cookieOptions());
  res.json({ data: publicUser(user), message: `Welcome, ${user.name} (${user.role})` });
}

// POST /api/auth/logout
export function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ data: null, message: "Logged out." });
}

// GET /api/auth/me — lets the React app restore the session after a refresh.
export function me(req, res) {
  res.json({ data: publicUser(req.user) });
}
