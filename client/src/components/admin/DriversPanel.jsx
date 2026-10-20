import { useState } from "react";
import { api } from "../../api/apiClient.js";
import { useFlash } from "../../context/FlashContext.jsx";

const EMPTY = { name: "", email: "", password: "", phone: "", licenseNumber: "" };
const STATUS_LABEL = { available: "available", assigned: "assigned", off_duty: "off duty" };

function DriverRow({ driver: d, onChanged }) {
  const { flash } = useFlash();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: d.name, phone: d.phone || "", licenseNumber: d.licenseNumber || "" });
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));

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

  const assigned = d.status === "assigned";

  return (
    <tr>
      <td>{editing ? <input aria-label="Name" value={form.name} maxLength={80} onChange={set("name")} /> : d.name}</td>
      <td>{d.email}</td>
      <td>{editing ? <input aria-label="Phone" value={form.phone} maxLength={20} onChange={set("phone")} /> : d.phone || "-"}</td>
      <td>
        {editing ? (
          <input aria-label="License number" value={form.licenseNumber} maxLength={40} onChange={set("licenseNumber")} />
        ) : (
          d.licenseNumber || "-"
        )}
      </td>
      <td>
        {STATUS_LABEL[d.status]}
        {d.currentBooking && <div className="small">{d.currentBooking.bookingId}</div>}
      </td>
      <td>
        <div className="action-row">
          {editing ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => run(() => api.patch(`/drivers/${d.id}`, form))}>
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
                  run(() => api.patch(`/drivers/${d.id}`, { status: d.status === "off_duty" ? "available" : "off_duty" }))
                }
              >
                {d.status === "off_duty" ? "Set available" : "Set off duty"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy || assigned}
                title={assigned ? "On an active booking" : ""}
                onClick={() => {
                  if (window.confirm(`Delete driver ${d.name} and their login? This cannot be undone.`)) {
                    run(() => api.delete(`/drivers/${d.id}`));
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

export default function DriversPanel({ drivers, onChanged }) {
  const { flash } = useFlash();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: form.name.trim(), email: form.email.trim(), password: form.password };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.licenseNumber.trim()) body.licenseNumber = form.licenseNumber.trim();
      const res = await api.post("/drivers", body);
      flash(`${res.message} They can now log in with ${body.email}.`);
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
        <table id="admin-drivers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email (login)</th>
              <th>Phone</th>
              <th>License</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 && (
              <tr>
                <td colSpan={6}>No drivers yet. Add one below.</td>
              </tr>
            )}
            {drivers.map((d) => (
              <DriverRow key={`${d.id}-${d.status}-${d.name}-${d.phone}-${d.licenseNumber}`} driver={d} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
      <form className="inline-form" onSubmit={add}>
        <h4>Add driver (creates their login)</h4>
        <input aria-label="Driver name" placeholder="Full name" required maxLength={80} value={form.name} onChange={set("name")} />
        <input aria-label="Driver email" type="email" placeholder="Email" required value={form.email} onChange={set("email")} />
        <input
          aria-label="Temporary password"
          type="password"
          autoComplete="new-password"
          placeholder="Temporary password (min. 8)"
          required
          minLength={8}
          value={form.password}
          onChange={set("password")}
        />
        <input aria-label="Driver phone" placeholder="Phone (optional)" maxLength={20} value={form.phone} onChange={set("phone")} />
        <input
          aria-label="License number"
          placeholder="License no. (optional)"
          maxLength={40}
          value={form.licenseNumber}
          onChange={set("licenseNumber")}
        />
        <button className="btn" type="submit" disabled={busy}>
          Add Driver
        </button>
      </form>
    </>
  );
}
