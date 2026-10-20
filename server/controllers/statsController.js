import { Booking, ACTIVE_STATUSES } from "../models/Booking.js";
import { Ambulance } from "../models/Ambulance.js";
import { Driver } from "../models/Driver.js";
import { User } from "../models/User.js";
import { Feedback } from "../models/Feedback.js";

// The three counters on the public Home page (same as the prototype).
async function publicCounts() {
  const [activeRequests, availableAmbulances, totalDrivers] = await Promise.all([
    Booking.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Ambulance.countDocuments({ status: "available" }),
    Driver.countDocuments(),
  ]);
  return { activeRequests, availableAmbulances, totalDrivers };
}

// GET /api/stats/public
export async function publicStats(_req, res) {
  res.json({ data: await publicCounts() });
}

// GET /api/stats/admin
export async function adminStats(_req, res) {
  const [base, newRequests, completedBookings, totalBookings, availableDrivers, totalUsers, rating] =
    await Promise.all([
      publicCounts(),
      Booking.countDocuments({ status: "new" }),
      Booking.countDocuments({ status: "completed" }),
      Booking.countDocuments(),
      Driver.countDocuments({ status: "available" }),
      User.countDocuments({ role: "user" }),
      Feedback.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    ]);
  res.json({
    data: {
      ...base,
      newRequests,
      completedBookings,
      totalBookings,
      availableDrivers,
      totalUsers,
      feedbackCount: rating[0]?.count ?? 0,
      averageRating: rating[0] ? Math.round(rating[0].avg * 10) / 10 : null,
    },
  });
}
