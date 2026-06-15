import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = authed
  const [applicant, setApplicant] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setApplicant(data.applicant);
    } catch (e) {
      setUser(false);
      setApplicant(null);
    }
  }, []);

  useEffect(() => {
    // If we're returning from Google auth callback, AuthCallback handles the exchange first.
    if (window.location.hash?.includes("session_id=")) {
      return;
    }
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("jc_token", data.token);
    await refresh();
    return data;
  }, [refresh]);

  const register = useCallback(async (email, password, display_name) => {
    const { data } = await api.post("/auth/register", { email, password, display_name });
    if (data.token) localStorage.setItem("jc_token", data.token);
    await refresh();
    return data;
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // server-side logout is best-effort; local state still cleared below
      console.warn("logout: server-side call failed", err?.message || err);
    }
    localStorage.removeItem("jc_token");
    setUser(false);
    setApplicant(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, applicant, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white/60 label-mono">
        AUTHORIZING…
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
