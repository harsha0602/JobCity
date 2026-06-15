import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || "/jobs-city";

  const [email, setEmail] = useState("demo@jobcity.test");
  const [password, setPassword] = useState("Demo123!");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      nav(returnTo);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/profile";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
      <form
        onSubmit={onSubmit}
        className="glass rounded-3xl p-8 w-full max-w-md relative"
        data-testid="login-form"
      >
        <button
          type="button"
          data-testid="login-guest-close-btn"
          onClick={() => nav("/")}
          aria-label="Continue as guest"
          title="Continue as guest"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <X size={18} />
        </button>
        <div className="label-mono">SIGN IN</div>
        <h1 className="text-3xl font-black mt-1">Welcome back to JobCity</h1>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="label-mono text-white/50">EMAIL</Label>
            <Input
              data-testid="login-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-black/40 border-white/10 text-white"
              required
            />
          </div>
          <div>
            <Label className="label-mono text-white/50">PASSWORD</Label>
            <Input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-black/40 border-white/10 text-white"
              required
            />
          </div>
        </div>

        {err && (
          <div data-testid="login-error" className="mt-4 text-sm text-[#FF3B30]">
            {err}
          </div>
        )}

        <Button
          data-testid="login-submit-btn"
          type="submit"
          disabled={busy}
          className="btn-applicants mt-6 w-full rounded-full py-6 h-auto"
        >
          {busy ? "Signing in…" : "Sign in →"}
        </Button>

        <div className="my-5 flex items-center gap-3 text-white/30 text-xs">
          <div className="h-px flex-1 bg-white/10" />
          OR
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <Button
          data-testid="google-signin-btn"
          type="button"
          onClick={onGoogle}
          variant="outline"
          className="w-full rounded-full bg-transparent border-white/15 text-white hover:bg-white/10"
        >
          Continue with Google
        </Button>

        <div className="mt-6 text-sm text-white/60">
          New here?{" "}
          <Link to="/register" className="text-[#00FFCC]" data-testid="goto-register-link">
            Create an account
          </Link>
        </div>
        <button
          type="button"
          data-testid="login-continue-as-guest-btn"
          onClick={() => nav("/")}
          className="mt-4 w-full text-center text-sm text-white/55 hover:text-white underline decoration-white/20 underline-offset-4 transition"
        >
          Skip — continue as guest →
        </button>
        <div className="mt-2 text-xs text-white/40 font-mono">
          Demo · demo@jobcity.test · Demo123!
        </div>
      </form>
    </div>
  );
}
