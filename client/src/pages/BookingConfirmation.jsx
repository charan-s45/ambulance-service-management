import { Link, useParams } from "react-router-dom";
import { useApiData } from "../hooks/useApiData.js";
import EtaDisplay from "../components/EtaDisplay.jsx";
import { ErrorState, Loading } from "../components/StatusMessages.jsx";
import { formatDateTime } from "../utils/format.js";

// Loaded from the API (not passed in memory), so it also works after a refresh.
export default function BookingConfirmation() {
  const { id } = useParams();
  const { data: booking, error, loading, reload } = useApiData(`/bookings/${id}`);

  return (
    <section id="confirm" className="active">
      <h1>Booking Confirmation</h1>
      <div className="card" id="confirm-card">
        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {booking && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <i className="fas fa-circle-check" style={{ fontSize: 28 }}></i>
              <h3 style={{ margin: 0 }}>Booking Confirmed!</h3>
            </div>
            <p>
              <strong>Booking ID:</strong> {booking.bookingId}
            </p>
            <p>
              <strong>Pickup:</strong> {booking.pickup}
            </p>
            <p>
              <strong>Destination:</strong> {booking.destination}
            </p>
            <p>
              <strong>Scheduled:</strong> {formatDateTime(booking.scheduledFor)}
            </p>
            <EtaDisplay booking={booking} />
            <p className="small">You can track live status anytime from the Home page.</p>
            <div style={{ marginTop: 15, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn secondary" to="/">
                Go to Home &amp; Status
              </Link>
              <Link className="btn" to="/my-bookings">
                My Bookings
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
