import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useApiData } from "../hooks/useApiData.js";
import { useFlash } from "../context/FlashContext.jsx";
import ArrivalMessage, { arrivalMessage } from "./ArrivalMessage.jsx";
import { findActiveBooking, findCompletedWithoutFeedback } from "../utils/format.js";
import StatusBadge from "./StatusBadge.jsx";
import EtaDisplay from "./EtaDisplay.jsx";
import { ErrorState } from "./StatusMessages.jsx";

const Title = () => (
  <h3>
    <i className="fas fa-route"></i> Your Active Booking Status
  </h3>
);

/**
 * "Your Active Booking Status" card. Shows the given bookings; the parent
 * loads them. `showEmpty` shows a message when there is nothing active
 * (the Home page hides the card instead, as the prototype did).
 */
export function TrackingCard({ bookings, error, reload, showEmpty = false }) {
  const { flash } = useFlash();
  const active = findActiveBooking(bookings);
  const lastSeen = useRef(null);

  // Pop up a message when the status changes while the page is open
  // (e.g. "Ambulance A101 has been assigned!").
  useEffect(() => {
    if (!active) return;
    const prev = lastSeen.current;
    lastSeen.current = { id: active.id, status: active.status };
    if (prev && prev.id === active.id && prev.status !== active.status) {
      const msg = arrivalMessage(active);
      if (msg) flash(`${msg.title} ${msg.text}`);
    }
  }, [active, flash]);

  if (error && !bookings) {
    return (
      <div className="hero-card wide">
        <Title />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!bookings) return null;

  if (!active) {
    const needsFeedback = findCompletedWithoutFeedback(bookings);
    if (needsFeedback) {
      return (
        <div className="hero-card wide" id="user-tracking-card">
          <Title />
          <p className="lead" style={{ color: "var(--danger)" }}>
            Your last service is complete! Please submit your feedback.
          </p>
          <Link className="btn" to={`/feedback/${needsFeedback.id}`}>
            Give Feedback for {needsFeedback.bookingId}
          </Link>
        </div>
      );
    }
    if (!showEmpty) return null;
    return (
      <div className="hero-card wide" id="user-tracking-card">
        <Title />
        <p className="small">You have no active booking right now.</p>
        <Link className="btn" to="/book">
          Book an Ambulance
        </Link>
      </div>
    );
  }

  return (
    <div className="hero-card wide" id="user-tracking-card">
      <Title />
      {error && <ErrorState error={{ message: `Could not refresh: ${error.message}` }} onRetry={reload} />}
      <ArrivalMessage booking={active} />
      <p>
        <strong>Request ID:</strong> {active.bookingId}
      </p>
      <p>
        <strong>Status:</strong> <StatusBadge status={active.status} />
      </p>
      <EtaDisplay booking={active} />
      <p className="small">
        <i className="fas fa-car-side"></i> {active.driver ? active.driver.name : "Unassigned Driver"}
        {active.driver?.phone ? ` (${active.driver.phone})` : ""} | <i className="fas fa-truck-medical"></i>{" "}
        {active.ambulance ? active.ambulance.vehicle : "Unassigned Ambulance"}
      </p>
      <p className="small" style={{ marginTop: 10 }}>
        Pickup: <strong>{active.pickup}</strong>
      </p>
      <p className="small">
        Destination: <strong>{active.destination}</strong>
      </p>
    </div>
  );
}

// Self-loading version for the Home page. Refreshes every 5 seconds, like the
// prototype, but with a single timer.
export default function BookingTrackingCard() {
  const { data, error, reload } = useApiData("/bookings/my", { pollMs: 5000 });
  return <TrackingCard bookings={data} error={error} reload={reload} />;
}
