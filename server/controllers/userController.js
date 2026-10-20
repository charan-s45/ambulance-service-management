import { User } from "../models/User.js";

// GET /api/users (admin) — password hashes are never selected.
export async function list(_req, res) {
  const users = await User.find().sort({ createdAt: -1 }).limit(1000);
  res.json({
    data: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      createdAt: u.createdAt,
    })),
  });
}
