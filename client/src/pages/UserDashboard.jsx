import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { TrackingCard } from "../components/BookingTrackingCard.jsx";
import BookingsTable from "../components/BookingsTable.jsx";
import { Loading } from "../components/StatusMessages.jsx";

const RECENT = 5;

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // One request feeds every card on this page; refreshed every 5 seconds.
  const { data: bookings, error, loading, reload } = useApiData("/bookings/my", { pollMs: 5000 });

  const count = (fn) => (bookings ? bookings.filter(fn).length : "…");

  return (
    <section id="user-dashboard" className="active">
      <h1>User Dashboard</h1>

      <div className="card">
        <strong>Welcome, {user?.name}</strong>
        <div className="stat-grid">
          <div className="stat">
            <small>Total Bookings</small>
            <strong>{bookings ? bookings.length : "…"}</strong>
          </div>
          <div className="stat">
            <small>Active</small>
            <strong>{count((b) => b.status !== "completed")}</strong>
          </div>
          <div className="stat">
            <small>Completed</small>
            <strong>{count((b) => b.status === "completed")}</strong>
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate("/book")}>
            Book an Ambulance
          </button>
          <button className="btn secondary" onClick={() => navigate("/my-bookings")}>
            View All My Bookings
          </button>
        </div>
      </div>

      <div className="dashboard-tracking">
        <TrackingCard bookings={bookings} error={error} reload={reload} showEmpty />
      </div>

      <div className="card">
        <h3>Recent Bookings</h3>
        {loading && <Loading />}
        {bookings && bookings.length === 0 && (
          <p>
            You have no bookings yet. <Link to="/book">Book an ambulance</Link>.
          </p>
        )}
        {bookings && bookings.length > 0 && (
          <>
            <BookingsTable bookings={bookings.slice(0, RECENT)} />
            {bookings.length > RECENT && (
              <p className="small">
                Showing the latest {RECENT}. <Link to="/my-bookings">See all {bookings.length}</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
