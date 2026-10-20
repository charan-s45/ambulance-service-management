import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Notice } from "../components/StatusMessages.jsx";

const EMPTY = { email: "", password: "", name: "", phone: "", licenseNumber: "", adminCode: "" };

const TITLES = { user: "Register", driver: "Register as Driver", admin: "Register as Admin" };

// Registration for the chosen account type:
// user   → email + password (as in the prototype)
// driver → also name (required), phone, license number
// admin  → also the secret admin registration code from the server's .env
export default function Register({ role = "user" }) {
  const { register } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (form.password.length < 8) {
      setStatus({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    const body = { role, email: form.email.trim(), password: form.password };
    if (form.name.trim()) body.name = form.name.trim();
    if (role !== "user" && form.phone.trim()) body.phone = form.phone.trim();
    if (role === "driver" && form.licenseNumber.trim()) body.licenseNumber = form.licenseNumber.trim();
    if (role === "admin") body.adminCode = form.adminCode;

    setBusy(true);
    try {
      const res = await register(body);
      setStatus({ type: "success", text: res.message });
      setForm(EMPTY);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-column">
      <h3>{TITLES[role]}</h3>
      <form id="register-form" className="form" onSubmit={handleSubmit}>
        {status && <Notice type={status.type}>{status.text}</Notice>}

        {role !== "user" && (
          <>
            <label htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required={role === "driver"}
              maxLength={80}
              placeholder={role === "driver" ? "Enter your full name" : "Enter your name (optional)"}
              value={form.name}
              onChange={set("name")}
            />
          </>
        )}

        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your email"
          value={form.email}
          onChange={set("email")}
        />
        <label htmlFor="reg-pass">Password</label>
        <input
          id="reg-pass"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="choose a password (min. 8 characters)"
          value={form.password}
          onChange={set("password")}
        />

        {role !== "user" && (
          <>
            <label htmlFor="reg-phone">Phone</label>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="Phone number (optional)"
              value={form.phone}
              onChange={set("phone")}
            />
          </>
        )}

        {role === "driver" && (
          <>
            <label htmlFor="reg-license">Driving license number</label>
            <input
              id="reg-license"
              type="text"
              maxLength={40}
              placeholder="License number (optional)"
              value={form.licenseNumber}
              onChange={set("licenseNumber")}
            />
          </>
        )}

        {role === "admin" && (
          <>
            <label htmlFor="reg-admin-code">Admin registration code</label>
            <input
              id="reg-admin-code"
              type="password"
              autoComplete="off"
              required
              placeholder="Code from the system owner"
              value={form.adminCode}
              onChange={set("adminCode")}
            />
            <p className="small">
              Admins can see every patient's details, so this code (set in the server's settings) is required.
            </p>
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
