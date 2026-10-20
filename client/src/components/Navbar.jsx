import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { dashboardPath, useAuth } from "../context/AuthContext.jsx";
import { useFlash } from "../context/FlashContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { flash } = useFlash();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  async function handleLogout() {
    close();
    try {
      await logout();
      flash("You have been logged out.");
    } catch {
      flash("Logged out on this device. The server could not be reached.", "error");
    }
    navigate("/");
  }

  return (
    <header className="navbar">
      <Link to="/" className="logo" onClick={close}>
        <img src="https://cdn-icons-png.flaticon.com/512/2966/2966327.png" alt="logo" />
        <div>
          <div style={{ fontSize: 20 }}>Ambulance Service</div>
          <div style={{ fontSize: 15, opacity: 0.9 }}>Management System</div>
        </div>
      </Link>

      <button
        type="button"
        className="menu-toggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`fas ${open ? "fa-xmark" : "fa-bars"}`}></i>
      </button>

      <nav className={`navlinks${open ? " open" : ""}`} id="main-nav">
        <NavLink to="/" end onClick={close}>Home</NavLink>
        <NavLink to="/about" onClick={close}>About</NavLink>
        <NavLink to="/services" onClick={close}>Services</NavLink>
        <NavLink to="/contact" onClick={close}>Contact</NavLink>
        {user?.role === "user" && (
          <NavLink to="/my-bookings" onClick={close}>My Bookings</NavLink>
        )}
        {user && (
          <NavLink to={dashboardPath(user)} end onClick={close} id="nav-dashboard">
            Dashboard
          </NavLink>
        )}
        {user ? (
          <button type="button" className="navlink-button" onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <NavLink to="/login" onClick={close}>Login / SignUp</NavLink>
        )}
      </nav>
    </header>
  );
}
