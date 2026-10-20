import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading, Notice } from "./StatusMessages.jsx";

// Navigation guard for a nicer user experience. Real security is enforced by
// the API: even if this check were bypassed, the server would refuse the data.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading text="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <section className="active">
        <Notice type="error">This page is not available for your account type ({user.role}).</Notice>
      </section>
    );
  }
  return children;
}
