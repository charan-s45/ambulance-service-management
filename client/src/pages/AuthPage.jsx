import { useSearchParams } from "react-router-dom";
import Login from "./Login.jsx";
import Register from "./Register.jsx";

export const LOGIN_TYPES = [
  { role: "user", label: "User", icon: "fa-user", text: "Book an ambulance and track your requests" },
  { role: "driver", label: "Driver", icon: "fa-truck-medical", text: "See and update your assignments" },
  { role: "admin", label: "Admin", icon: "fa-user-shield", text: "Manage requests, ambulances and drivers" },
];

// Login page with a separate entry for each kind of account. The choice is
// kept in the URL (/login?as=driver) so each login has its own link.
export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const role = LOGIN_TYPES.some((t) => t.role === params.get("as")) ? params.get("as") : "user";
  const current = LOGIN_TYPES.find((t) => t.role === role);

  return (
    <section id="login" className="active">
      <h1>Login / Register</h1>

      <div className="role-picker" role="tablist" aria-label="Choose login type">
        {LOGIN_TYPES.map((t) => (
          <button
            key={t.role}
            type="button"
            role="tab"
            aria-selected={t.role === role}
            className={`role-option${t.role === role ? " selected" : ""}`}
            onClick={() => setParams(t.role === "user" ? {} : { as: t.role }, { replace: true })}
          >
            <i className={`fas ${t.icon}`}></i>
            <strong>{t.label}</strong>
            <span>{t.text}</span>
          </button>
        ))}
      </div>

      <div className="card auth-card">
        {/* key: reset the forms when switching login type */}
        <Login key={`login-${role}`} role={role} title={`${current.label} Login`} />
        <Register key={`register-${role}`} role={role} />
      </div>
    </section>
  );
}
