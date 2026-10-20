import { useState } from "react";
import { api } from "../../api/apiClient.js";
import { useFlash } from "../../context/FlashContext.jsx";

const EMPTY = { code: "", vehicle: "", registrationNumber: "" };

function AmbulanceRow({ ambulance: a, onChanged }) {
  const { flash } = useFlash();
  const [editing, setEditing] = useState(false);
  const [vehicle, setVehicle] = useState(a.vehicle);
  const [registrationNumber, setReg] = useState(a.registrationNumber || "");
  const [busy, setBusy] = useState(false);

  async function run(request) {
    setBusy(true);
    try {
      const res = await request();
      flash(res.message);
      setEditing(false);
      await onChanged();
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const assigned = a.status === "assigned";

  return (
    <tr>
      <td>{a.code}</td>
      <td>
        {editing ? (
          <input aria-label="Vehicle" value={vehicle} maxLength={100} onChange={(e) => setVehicle(e.target.value)} />
        ) : (
          a.vehicle
        )}
      </td>
      <td>
        {editing ? (
          <input
            aria-label="Registration number"
            value={registrationNumber}
            maxLength={30}
            onChange={(e) => setReg(e.target.value)}
          />
        ) : (
          a.registrationNumber || "-"
        )}
      </td>
      <td>
        {a.status}
        {a.currentBooking && <div className="small">{a.currentBooking.bookingId}</div>}
      </td>
      <td>
        <div className="action-row">
          {editing ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => run(() => api.patch(`/ambulances/${a._id}`, { vehicle, registrationNumber }))}
              >
                Save
              </button>
              <button type="button" className="btn secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn secondary" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || assigned}
                title={assigned ? "On an active booking" : ""}
                onClick={() =>
                  run(() =>
                    api.patch(`/ambulances/${a._id}`, {
                      status: a.status === "maintenance" ? "available" : "maintenance",
                    }),
                  )
                }
              >
                {a.status === "maintenance" ? "Mark available" : "Maintenance"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy || assigned}
                title={assigned ? "On an active booking" : ""}
                onClick={() => {
                  if (window.confirm(`Delete ambulance ${a.code}? This cannot be undone.`)) {
                    run(() => api.delete(`/ambulances/${a._id}`));
                  }
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AmbulancesPanel({ ambulances, onChanged }) {
  const { flash } = useFlash();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/ambulances", {
        code: form.code.trim(),
        vehicle: form.vehicle.trim(),
        registrationNumber: form.registrationNumber.trim(),
      });
      flash(res.message);
      setForm(EMPTY);
      await onChanged();
    } catch (err) {
      flash(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table id="admin-ambulances-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehicle</th>
              <th>Reg. No.</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ambulances.length === 0 && (
              <tr>
                <td colSpan={5}>No ambulances yet. Add one below.</td>
              </tr>
            )}
            {ambulances.map((a) => (
              <AmbulanceRow key={`${a._id}-${a.updatedAt}`} ambulance={a} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
      <form className="inline-form" onSubmit={add}>
        <h4>Add ambulance</h4>
        <input aria-label="Ambulance ID" placeholder="ID, e.g. A104" required maxLength={20} value={form.code} onChange={set("code")} />
        <input aria-label="Vehicle" placeholder="Vehicle description" required maxLength={100} value={form.vehicle} onChange={set("vehicle")} />
        <input
          aria-label="Registration number"
          placeholder="Registration no. (optional)"
          maxLength={30}
          value={form.registrationNumber}
          onChange={set("registrationNumber")}
        />
        <button className="btn" type="submit" disabled={busy}>
          Add Ambulance
        </button>
      </form>
    </>
  );
}
