import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/apiClient.js";
import { useApiData } from "../hooks/useApiData.js";
import { useFlash } from "../context/FlashContext.jsx";
import { ErrorState, Loading, Notice } from "../components/StatusMessages.jsx";

export default function Feedback() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { flash } = useFlash();
  const { data: booking, error: loadError, loading, reload } = useApiData(`/bookings/${bookingId}`);
  const [rating, setRating] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!rating) {
      setError("Please select an overall rating.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/feedback", {
        bookingId,
        rating: Number(rating),
        comments: comments.trim(),
      });
      flash(res.message);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  let blocked = null;
  if (booking && booking.status !== "completed") {
    blocked = "Feedback can be given once this service is completed.";
  } else if (booking?.feedback) {
    blocked = `Feedback already submitted for this request (${booking.feedback.rating}/5).`;
  }

  return (
    <section id="feedback" className="active">
      <h1>Service Feedback</h1>
      <div className="card">
        {loading && <Loading />}
        <ErrorState error={loadError} onRetry={reload} />
        {booking && blocked && (
          <>
            <Notice type="info">{blocked}</Notice>
            <Link className="btn secondary" to="/my-bookings">
              Back to My Bookings
            </Link>
          </>
        )}
        {booking && !blocked && (
          <>
            <p className="lead">
              We value your opinion. Please provide feedback on your recent ambulance service with ID:{" "}
              <strong id="feedback-req-id">{booking.bookingId}</strong>.
            </p>
            <form id="feedback-form" className="form" onSubmit={handleSubmit}>
              {error && <Notice type="error">{error}</Notice>}
              <label htmlFor="f-rating">Overall Rating (1-5)</label>
              <select id="f-rating" required value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">-- Select Rating --</option>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Fair</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Very Poor</option>
              </select>
              <label htmlFor="f-comments">Comments</label>
              <textarea
                id="f-comments"
                rows={4}
                maxLength={1000}
                placeholder="Share your experience (optional)"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              ></textarea>
              <div style={{ marginTop: 12 }}>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
