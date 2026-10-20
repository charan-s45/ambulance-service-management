import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFlash } from "../context/FlashContext.jsx";
import { findCompletedWithoutFeedback } from "../utils/format.js";
import { Notice } from "../components/StatusMessages.jsx";

// Where to go after login (same rules as the prototype's handleLogin()):
// admin → admin dashboard, driver → driver dashboard,
// user → feedback form if a completed booking still needs feedback, else user dashboard.
async function landingPathFor(user) {
  if (user.role === "admin") return "/admin";
  if (user.role === "driver") return "/driver";
  try {
    const res = await api.get("/bookings/my");
    const pending = findCompletedWithoutFeedback(res.data);
    if (pending) return `/feedback/${pending.id}`;
  } catch {
    // Not critical — just go to the dashboard.
  }
  return "/dashboard";
}

export default function Login({ role = "user", title = "Login" }) {
  const { login } = useAuth();
  const { flash } = useFlash();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email.trim(), password, role);
      flash(res.message);
      const from = location.state?.from;
      navigate(from && from !== "/login" ? from : await landingPathFor(res.data));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-column">
      <h3>{title}</h3>
      <form id="login-form" className="form" onSubmit={handleSubmit}>
        {error && <Notice type="error">{error}</Notice>}
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="login-pass">Password</label>
        <input
          id="login-pass"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Logging in..." : title}
          </button>
        </div>
      </form>
    </div>
  );
}
