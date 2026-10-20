import { Feedback } from "../models/Feedback.js";
import { Booking } from "../models/Booking.js";
import { conflict, notFound } from "../utils/AppError.js";

// POST /api/feedback (user) — only for the user's own completed booking, once.
export async function create(req, res) {
  const { bookingId, rating, comments } = req.body;
  const booking = await Booking.findById(bookingId);
  // Someone else's booking is reported as "not found" to avoid leaking it.
  if (!booking || !booking.user.equals(req.user._id)) throw notFound("Booking not found.");
  if (booking.status !== "completed") {
    throw conflict("Feedback can only be given after the service is completed.");
  }
  if (await Feedback.exists({ booking: booking._id })) {
    throw conflict("Feedback already submitted for this request.");
  }
  const fb = await Feedback.create({
    booking: booking._id,
    user: req.user._id,
    rating,
    comments: comments || "",
  });
  res.status(201).json({
    data: { id: fb._id.toString(), bookingId: booking.bookingId, rating: fb.rating, comments: fb.comments },
    message: `Thank you for your feedback! Rating: ${rating}/5`,
  });
}

// GET /api/feedback (admin)
export async function list(_req, res) {
  const items = await Feedback.find()
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("user", "name email")
    .populate("booking", "bookingId");
  res.json({
    data: items.map((f) => ({
      id: f._id.toString(),
      bookingId: f.booking?.bookingId ?? null,
      user: f.user ? { name: f.user.name, email: f.user.email } : null,
      rating: f.rating,
      comments: f.comments,
      createdAt: f.createdAt,
    })),
  });
}
