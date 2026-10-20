import { useState } from "react";
import { api } from "../../api/apiClient.js";
import { useFlash } from "../../context/FlashContext.jsx";
import StatusBadge from "../StatusBadge.jsx";
import EtaDisplay from "../EtaDisplay.jsx";
import StatusActions from "../StatusActions.jsx";
import { formatDateTime } from "../../utils/format.js";

const DRIVER_STATUS_LABEL = { available: "available", assigned: "assigned", off_duty: "off duty" };

function AssignControls({ booking, ambulances, drivers, onChanged }) {
  const { flash } = useFlash();
  const [ambulanceId, setAmbulanceId] = useState(booking.ambulance?.id || "");
  const [driverId, setDriverId] = useState(booking.driver?.id || "");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!ambulanceId || !driverId) {
      flash("Please select both an ambulance and a driver.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/bookings/${booking.id}/assign`, { ambulanceId, driverId });
      flash(res.message);
      await onChanged();
    } catch (err) {
      flash(err.message, "error");
      await onChanged(); // refresh so the lists show current availability
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assign-controls">
      <select
        aria-label={`Ambulance for ${booking.bookingId}`}
        value={ambulanceId}
        onChange={(e) => setAmbulanceId(e.target.value)}
      >
        <option value="">-- Assign Ambulance --</option>
        {ambulances.map((a) => (
          <option key={a._id} value={a._id} disabled={a.status !== "available" && a._id !== booking.ambulance?.id}>
            {a.code} ({a.status})
          </option>
        ))}
      </select>
      <select aria-label={`Driver for ${booking.bookingId}`} value={driverId} onChange={(e) => setDriverId(e.target.value)}>
        <option value="">-- Assign Driver --</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id} disabled={d.status !== "available" && d.id !== booking.driver?.id}>
            {d.name} ({DRIVER_STATUS_LABEL[d.status]})
          </option>
        ))}
      </select>
      <button type="button" className="btn" disabled={busy} onClick={assign}>
        {booking.status === "pending" ? "Re-assign" : "Assign"}
      </button>
    </div>
  );
}

export default function RequestsTable({ bookings, ambulances, drivers, onChanged }) {
  if (bookings.length === 0) return <p className="small">No requests yet.</p>;
  return (
    <div className="table-wrap">
      <table id="admin-requests-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Pickup</th>
            <th>Destination</th>
            <th>When</th>
            <th>Status</th>
            <th>Ambulance</th>
            <th>Driver</th>
            <th>Feedback</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((r) => (
            // Re-mount the row when the booking changes so inputs show fresh values.
            <tr key={`${r.id}-${r.updatedAt}`}>
              <td>
                {r.bookingId}
                {r.user && <div className="small">{r.user.name}</div>}
              </td>
              <td>{r.pickup}</td>
              <td>{r.destination}</td>
              <td>
                <div className="small">{formatDateTime(r.scheduledFor)}</div>
              </td>
              <td>
                <StatusBadge status={r.status} />
                <div>
                  <EtaDisplay booking={r} compact />
                </div>
              </td>
              <td>{r.ambulance?.code || "-"}</td>
              <td>{r.driver?.name || "-"}</td>
              <td>{r.feedback ? `${r.feedback.rating}/5` : r.status === "completed" ? "Pending" : "-"}</td>
              <td>
                {(r.status === "new" || r.status === "pending") && (
                  <AssignControls booking={r} ambulances={ambulances} drivers={drivers} onChanged={onChanged} />
                )}
                <StatusActions booking={r} onChanged={onChanged} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
