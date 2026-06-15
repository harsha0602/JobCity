import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Handles the Emergent Google Auth callback (`#session_id=...`).
 * We exchange the session_id for our auth cookies, then navigate.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      nav("/login");
      return;
    }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        if (data?.token) localStorage.setItem("jc_token", data.token);
        window.history.replaceState(null, "", window.location.pathname);
        // AuthProvider skipped its initial refresh() because the hash carried
        // session_id; hydrate the user now so /profile isn't stuck on "AUTHORIZING…".
        await refresh();
        nav("/profile", { replace: true });
      } catch (e) {
        nav("/login?error=google", { replace: true });
      }
    })();
  }, [nav, refresh]);

  return (
    <div className="flex items-center justify-center min-h-screen text-white/60 label-mono">
      AUTHORIZING WITH GOOGLE…
    </div>
  );
}
