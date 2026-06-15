import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await register(email, password, name || email.split("@")[0]);
      nav("/onboarding");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
      <form
        onSubmit={onSubmit}
        className="glass rounded-3xl p-8 w-full max-w-md relative"
        data-testid="register-form"
      >
        <button
          type="button"
          data-testid="register-guest-close-btn"
          onClick={() => nav("/")}
          aria-label="Continue as guest"
          title="Continue as guest"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <X size={18} />
        </button>
        <div className="label-mono">JOIN</div>
        <h1 className="text-3xl font-black mt-1">
          Claim your tower in <span className="text-[#00FFCC]">Applicants City</span>
        </h1>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="label-mono text-white/50">DISPLAY NAME</Label>
            <Input
              data-testid="register-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-black/40 border-white/10 text-white"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <Label className="label-mono text-white/50">EMAIL</Label>
            <Input
              data-testid="register-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-black/40 border-white/10 text-white"
              required
            />
          </div>
          <div>
            <Label className="label-mono text-white/50">PASSWORD</Label>
            <Input
              data-testid="register-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 bg-black/40 border-white/10 text-white"
              required
            />
          </div>
        </div>

        {err && (
          <div data-testid="register-error" className="mt-4 text-sm text-[#FF3B30]">
            {err}
          </div>
        )}

        <Button
          data-testid="register-submit-btn"
          type="submit"
          disabled={busy}
          className="btn-applicants mt-6 w-full rounded-full py-6 h-auto"
        >
          {busy ? "Creating…" : "Create my tower →"}
        </Button>

        <div className="mt-6 text-sm text-white/60">
          Already have an account?{" "}
          <Link to="/login" className="text-[#00FFCC]" data-testid="goto-login-link">
            Sign in
          </Link>
        </div>
        <button
          type="button"
          data-testid="register-continue-as-guest-btn"
          onClick={() => nav("/")}
          className="mt-4 w-full text-center text-sm text-white/55 hover:text-white underline decoration-white/20 underline-offset-4 transition"
        >
          Skip — continue as guest →
        </button>
      </form>
    </div>
  );
}
