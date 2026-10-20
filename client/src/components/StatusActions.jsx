import { useState } from "react";
import { api } from "../api/apiClient.js";
import { useFlash } from "../context/FlashContext.jsx";

// The next status the server will accept from each status (mirrors the API).
export const NEXT_STATUS = { pending: "enroute", enroute: "arrived", arrived: "completed" };

/**
 * ETA box + "Update ETA" + En route / Arrived / Complete buttons.
 * Used on both the admin and the driver dashboards. Buttons that are not a
 * valid next step are disabled (the server enforces the same rules).
 */
export default function StatusActions({ booking, onChanged }) {
  const { flash } = useFlash();
  const reportedEta = booking.eta?.source && booking.eta.source !== "default_estimate" ? booking.eta.minutes : null;
  const [eta, setEta] = useState(reportedEta ? String(reportedEta) : "");
  const [busy, setBusy] = useState(false);

  const next = NEXT_STATUS[booking.status];
  const etaNum = Number.parseInt(eta, 10);
  const etaValid = Number.isInteger(etaNum) && etaNum > 0 && etaNum <= 600;
  const canEditEta = booking.status === "pending" || booking.status === "enroute";

  async function run(request) {
    setBusy(true);
    try {
      const res = await request();
      flash(res.message);
      await onChanged?.();
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function setStatus(status) {
    if (status === "enroute" && !etaValid) {
      flash('Please set a valid Estimated Time of Arrival (ETA) in minutes before setting status to "En route".', "error");
      return;
    }
    run(() =>
      api.patch(`/bookings/${booking.id}/status`, status === "enroute" ? { status, etaMinutes: etaNum } : { status }),
    );
  }

  function updateEta() {
    if (!etaValid) {
      flash("Please enter an ETA between 1 and 600 minutes.", "error");
      return;
    }
    run(() => api.patch(`/bookings/${booking.id}/eta`, { etaMinutes: etaNum }));
  }

  if (booking.status === "completed") return <span>Completed</span>;
  if (booking.status === "new") return <span className="small">Waiting for assignment</span>;

  return (
    <div className="action-row">
      {canEditEta && (
        <>
          <input
            type="number"
            min={1}
            max={600}
            aria-label={`ETA in minutes for ${booking.bookingId}`}
            placeholder="ETA (mins)"
            className="eta-input"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
          <button type="button" className="btn secondary" disabled={busy} onClick={updateEta}>
            Update ETA
          </button>
        </>
      )}
      <button
        type="button"
        className="btn secondary"
        disabled={busy || next !== "enroute"}
        onClick={() => setStatus("enroute")}
      >
        En route
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={busy || next !== "arrived"}
        onClick={() => setStatus("arrived")}
      >
        Arrived
      </button>
      <button
        type="button"
        className="btn success"
        disabled={busy || next !== "completed"}
        onClick={() => setStatus("completed")}
      >
        Complete
      </button>
    </div>
  );
}
