import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setUnauthorizedHandler } from "../api/apiClient.js";
import { useFlash } from "./FlashContext.jsx";

const AuthContext = createContext(null);

// Keeps the logged-in user in React state. The real proof of login is the
// HttpOnly cookie, which JavaScript cannot read; on page load we ask the
// server "who am I?" (GET /api/auth/me) to restore the session.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  const navigate = useNavigate();
  const { flash } = useFlash();

  const updateUser = useCallback((u) => {
    userRef.current = u;
    setUser(u);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then((res) => !cancelled && updateUser(res.data))
      .catch(() => !cancelled && updateUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [updateUser]);

  // Any 401 while we thought we were logged in = the session expired.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!userRef.current) return;
      updateUser(null);
      flash("Your session has expired. Please log in again.", "error");
      navigate("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [flash, navigate, updateUser]);

  const login = useCallback(
    async (email, password, role) => {
      const res = await api.post("/auth/login", { email, password, role });
      updateUser(res.data);
      return res;
    },
    [updateUser],
  );

  const register = useCallback((body) => api.post("/auth/register", body), []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      updateUser(null);
    }
  }, [updateUser]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function dashboardPath(user) {
  if (!user) return "/login";
  if (user.role === "admin") return "/admin";
  if (user.role === "driver") return "/driver";
  return "/dashboard";
}
