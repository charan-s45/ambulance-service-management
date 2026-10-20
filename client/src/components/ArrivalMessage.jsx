import { formatDateTime, formatTime, minutesRemaining } from "../utils/format.js";

// Bookings scheduled further ahead than this are "planned" trips: we show the
// pickup time instead of an arrival countdown.
const SCHEDULED_AHEAD_MS = 60 * 60 * 1000;

const mins = (n) => `${n} minute${n === 1 ? "" : "s"}`;

/**
 * Big, plain-language message for the patient:
 * "Ambulance A101 has been assigned! Driver Ramesh will arrive in about 12 minutes."
 * ETA wording stays honest: estimates are called estimates, nothing claims GPS.
 */
export function arrivalMessage(booking, now = Date.now()) {
  const { status, ambulance, driver, eta } = booking;
  const amb = ambulance ? `Ambulance ${ambulance.code}` : "An ambulance";
  const drv = driver ? `Driver ${driver.name}` : "The driver";
  const left = minutesRemaining(eta, now);
  const plannedFor =
    new Date(booking.scheduledFor).getTime() - now > SCHEDULED_AHEAD_MS ? formatDateTime(booking.scheduledFor) : null;

  switch (status) {
    case "new":
      return {
        tone: "waiting",
        icon: "fa-hourglass-half",
        title: "Request received",
        text: "We are assigning an ambulance and driver to you. This page updates automatically.",
      };
    case "pending": {
      let when;
      if (plannedFor) when = `will pick you up as scheduled on ${plannedFor}.`;
      else if (left !== null) when = `will arrive in about ${mins(left)}.`;
      else if (eta?.minutes) when = `will arrive in about ${mins(eta.minutes)} (estimate).`;
      else when = "is getting ready.";
      return { tone: "assigned", icon: "fa-truck-medical", title: `${amb} has been assigned!`, text: `${drv} ${when}` };
    }
    case "enroute": {
      let when;
      if (left === null) when = "is on the way to you.";
      else if (left === 0) when = "should be arriving any moment now.";
      else when = `is on the way and will arrive in about ${mins(left)} (around ${formatTime(now + left * 60000)}).`;
      return { tone: "enroute", icon: "fa-truck-fast", title: `${amb} is on the way!`, text: `${drv} ${when}` };
    }
    case "arrived":
      return {
        tone: "arrived",
        icon: "fa-location-dot",
        title: "Your ambulance has arrived!",
        text: `${amb} is at the pickup location: ${booking.pickup}.`,
      };
    default:
      return null;
  }
}

export default function ArrivalMessage({ booking }) {
  const msg = arrivalMessage(booking);
  if (!msg) return null;
  return (
    <div className={`arrival-banner ${msg.tone}`} role="status" aria-live="polite">
      <i className={`fas ${msg.icon}`} aria-hidden="true"></i>
      <div>
        <strong>{msg.title}</strong>
        <p>{msg.text}</p>
        {booking.driver?.phone && msg.tone !== "waiting" && (
          <p className="arrival-contact">
            <i className="fas fa-phone" aria-hidden="true"></i>{" "}
            <a href={`tel:${booking.driver.phone}`}>Call driver: {booking.driver.phone}</a>
          </p>
        )}
      </div>
    </div>
  );
}
