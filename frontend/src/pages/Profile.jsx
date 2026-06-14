import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";

export default function ProfilePage() {
  const { user, applicant, refresh } = useAuth();
  const [apps, setApps] = useState([]);
  const [gh, setGh] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(r.data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (applicant?.github_username) setGh(applicant.github_username);
  }, [applicant?.github_username]);

  if (!user) return <div className="pt-32 text-center text-white/60 label-mono">LOADING…</div>;

  const onLinkGithub = async (e) => {
    e.preventDefault();
    if (!gh.trim()) return;
    setLinking(true);
    try {
      const { data } = await api.post("/applicants/me/github", { github_username: gh.trim() });
      if (data.warning) toast.warning(data.warning);
      else toast.success(`Linked @${data.github_username} · ${data.github_commits_30d} commits / 30d`);
      await refresh();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLinking(false);
    }
  };

  const onSyncGithub = async () => {
    setLinking(true);
    try {
      const { data } = await api.post("/applicants/me/github/sync");
      toast.success(`Synced · ${data.github_commits_30d} commits / 30d`);
      await refresh();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <Toaster theme="dark" position="top-right" />
      <div className="max-w-4xl mx-auto">
        <div className="label-mono">MY PROFILE</div>
        <h1 className="text-4xl font-black mt-1">{user.name || user.email}</h1>
        <div className="text-white/60 mt-1 font-mono text-sm">{user.email}</div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <Stat
            label="APPLICATIONS"
            value={applicant?.applications_count ?? 0}
            color="#00FFCC"
            testid="stat-applications"
          />
          <Stat
            label="EXPERIENCE"
            value={(applicant?.experience_level || "entry").toUpperCase()}
            color="#FFB24C"
            testid="stat-experience"
          />
          <Stat
            label="GITHUB"
            value={applicant?.github_username ? `@${applicant.github_username}` : "—"}
            color="#FF5F6D"
            testid="stat-github"
          />
        </div>

        {applicant && (
          <div className="mt-6">
            <Link
              data-testid="my-building-link"
              to={`/applicants/${applicant.applicant_id}`}
              className="inline-block text-[#00FFCC] underline-offset-4 hover:underline"
            >
              View my building in Applicants City →
            </Link>
          </div>
        )}

        <form onSubmit={onLinkGithub} className="mt-6 glass rounded-3xl p-7" data-testid="github-link-form">
          <div className="label-mono">LINK GITHUB</div>
          <h2 className="text-xl font-bold mt-1">Light up your tower&apos;s antenna</h2>
          <p className="text-white/60 text-sm mt-1">
            We&apos;ll fetch your last-30-day public commit count and stamp it on your building. No OAuth needed — just your handle.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="label-mono text-white/50">GITHUB USERNAME</Label>
              <Input
                data-testid="github-username-input"
                value={gh}
                onChange={(e) => setGh(e.target.value)}
                placeholder="e.g. torvalds"
                className="mt-1 bg-black/40 border-white/10 text-white"
              />
            </div>
            <div className="flex gap-2 sm:items-end">
              <Button
                data-testid="github-link-btn"
                type="submit"
                disabled={linking}
                className="btn-applicants rounded-full"
              >
                {linking ? "Linking…" : "Link & fetch commits"}
              </Button>
              {applicant?.github_username && (
                <Button
                  data-testid="github-sync-btn"
                  type="button"
                  variant="ghost"
                  className="text-white/70"
                  onClick={onSyncGithub}
                  disabled={linking}
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>
          {applicant?.github_username && (
            <div className="mt-3 font-mono text-xs text-white/60">
              ⌁ Currently linked: @{applicant.github_username} · {applicant.github_commits_30d || 0} commits / 30d
            </div>
          )}
        </form>

        <div className="mt-8 glass rounded-3xl p-7">
          <div className="label-mono">MY APPLICATIONS</div>
          {apps.length === 0 ? (
            <div className="mt-3 text-white/50">
              You haven&apos;t applied to anything yet.{" "}
              <Link to="/jobs-city" className="text-[#FF5F6D]">
                Explore Jobs City →
              </Link>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-white/5">
              {apps.map((a) => (
                <Link
                  key={a.job_id + a.applied_at}
                  to={`/jobs/${a.job_id}`}
                  data-testid={`my-app-${a.job_id}`}
                  className="flex items-center justify-between py-3 hover:bg-white/5 px-2 rounded-lg"
                >
                  <div>
                    <div className="font-semibold">{a.job_title}</div>
                    <div className="font-mono text-[11px] text-white/50">
                      {a.company_name} · {a.city}, {a.state}
                    </div>
                  </div>
                  <div className="font-mono text-[11px] text-white/40">
                    {new Date(a.applied_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, testid }) {
  return (
    <div className="glass rounded-2xl p-5" data-testid={testid}>
      <div className="label-mono">{label}</div>
      <div className="font-mono text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
