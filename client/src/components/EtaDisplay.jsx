import { formatTime } from "../utils/format.js";

const SOURCE_LABEL = { dispatcher: "dispatcher", driver: "driver" };

/**
 * Shows the ETA honestly:
 * - "default_estimate": a configurable typical response time, NOT a prediction
 *   for this trip (the prototype showed a random number here).
 * - "dispatcher"/"driver": a number a person entered, with the time they entered it.
 * Nothing here is live GPS tracking.
 */
export default function EtaDisplay({ booking, compact = false }) {
  const { status, eta } = booking;
  if (status === "arrived" || status === "completed") return null;

  if (!eta?.minutes) {
    return compact ? <span className="small">ETA pending</span> : <p className="small">ETA calculation pending...</p>;
  }

  const reported = eta.source === "dispatcher" || eta.source === "driver";
  const expectedAt = reported && eta.updatedAt ? new Date(new Date(eta.updatedAt).getTime() + eta.minutes * 60000) : null;

  const note = reported
    ? `reported by ${SOURCE_LABEL[eta.source]} at ${formatTime(eta.updatedAt)}${expectedAt ? `, expected around ${formatTime(expectedAt)}` : ""} — not live GPS`
    : "typical response estimate — not based on live location; will be updated by the dispatcher or driver";

  if (compact) {
    return (
      <span className="small" title={note}>
        (ETA: {eta.minutes} mins{reported ? "" : ", estimate"})
      </span>
    );
  }

  return (
    <p>
      <strong>{reported ? "ETA to Pickup" : "Estimated Arrival"}:</strong>{" "}
      <span className="eta-value">{eta.minutes} mins</span> <span className="small">({note})</span>
    </p>
  );
}
