import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFlash } from "../context/FlashContext.jsx";
import { Notice } from "../components/StatusMessages.jsx";
import { toIsoFromLocal, todayLocal } from "../utils/format.js";

const EMPTY = { pickup: "", destination: "", date: "", time: "" };

export default function BookAmbulance() {
  const { user } = useAuth();
  const { flash } = useFlash();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    // Same rule as the prototype: only logged-in users can book.
    if (!user || user.role !== "user") {
      flash("You must be logged in as a User to book an ambulance.", "error");
      navigate("/login", { state: { from: "/book" } });
      return;
    }
    const pickup = form.pickup.trim();
    const destination = form.destination.trim();
    const scheduledFor = toIsoFromLocal(form.date, form.time);
    if (!pickup || !destination || !scheduledFor) {
      setError("Please fill all fields");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/bookings", { pickup, destination, scheduledFor });
      setForm(EMPTY);
      navigate(`/bookings/${res.data.id}/confirmation`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="booking" className="active">
      <h1>Book an Ambulance</h1>
      <div className="card">
        <form id="booking-form" className="form" onSubmit={handleSubmit}>
          {!user && <Notice type="info">Please log in as a User to submit a booking.</Notice>}
          {user && user.role !== "user" && (
            <Notice type="info">Bookings can only be made from a User account.</Notice>
          )}
          {error && <Notice type="error">{error}</Notice>}
          <label htmlFor="b-pickup">Pickup Location</label>
          <input
            id="b-pickup"
            type="text"
            required
            maxLength={200}
            placeholder="Enter pickup address"
            value={form.pickup}
            onChange={set("pickup")}
          />
          <label htmlFor="b-dest">Destination</label>
          <input
            id="b-dest"
            type="text"
            required
            maxLength={200}
            placeholder="Enter destination"
            value={form.destination}
            onChange={set("destination")}
          />
          <div className="grid-2">
            <div>
              <label htmlFor="b-date">Date</label>
              <input id="b-date" type="date" required min={todayLocal()} value={form.date} onChange={set("date")} />
            </div>
            <div>
              <label htmlFor="b-time">Time</label>
              <input id="b-time" type="time" required value={form.time} onChange={set("time")} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
