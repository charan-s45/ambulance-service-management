import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import BookingTrackingCard from "../components/BookingTrackingCard.jsx";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, error } = useApiData("/stats/public", { pollMs: 15000 });

  const show = (key) => (stats ? stats[key] : error ? "–" : "…");

  return (
    <section id="home" className="active">
      <div className="hero">
        <div className="hero-card">
          <h1 style={{ textAlign: "center" }}>Every second counts — Your life, our priority</h1>
          <p className="lead">Fast, reliable ambulance services with real-time status updates and 24/7 Support</p>
          <div className="stat-grid">
            <div className="stat">
              <small>Active Requests</small>
              <strong id="ui-active-requests">{show("activeRequests")}</strong>
            </div>
            <div className="stat">
              <small>Available Ambulances</small>
              <strong id="ui-available-amb">{show("availableAmbulances")}</strong>
            </div>
            <div className="stat">
              <small>Total Drivers</small>
              <strong id="ui-total-drivers">{show("totalDrivers")}</strong>
            </div>
          </div>
          {error && <p className="small">Live counters are unavailable right now.</p>}
        </div>

        <div className="hero-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="btn" onClick={() => navigate("/book")}>Book an Ambulance</button>
            <button className="btn secondary" onClick={() => navigate("/services")}>View Services</button>
            <button className="btn" onClick={() => navigate("/contact")}>Contact Us</button>
          </div>
        </div>

        {user?.role === "user" && <BookingTrackingCard />}
      </div>
    </section>
  );
}
