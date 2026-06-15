import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";

const TITLE_SUGGESTIONS = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "ML Engineer",
  "Data Scientist",
  "Robotics Engineer",
  "DevOps Engineer",
  "Mobile Engineer",
  "Product Designer",
];

export default function ProfilePage() {
  const { user, applicant, refresh } = useAuth();
  const [apps, setApps] = useState([]);
  const [gh, setGh] = useState("");
  const [linking, setLinking] = useState(false);

  // Editable profile state
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [experience, setExperience] = useState("entry");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(r.data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!applicant) return;
    setGh(applicant.github_username || "");
    setTitle(applicant.title || "");
    setSkills(applicant.skills || []);
    setResumeUrl(applicant.resume_url || "");
    setExperience(applicant.experience_level || "entry");
  }, [applicant]);

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

  const addSkill = (raw) => {
    const s = raw.trim();
    if (!s || skills.includes(s) || skills.length >= 20) return;
    setSkills([...skills, s]);
  };

  const onSkillKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
      setSkillInput("");
    } else if (e.key === "Backspace" && !skillInput && skills.length) {
      setSkills(skills.slice(0, -1));
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch("/applicants/me", {
        title,
        skills,
        resume_url: resumeUrl,
        experience_level: experience,
      });
      toast.success("Profile updated.");
      await refresh();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSavingProfile(false);
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
              to="/applicants-city?navigate=me"
              className="inline-block text-[#00FFCC] underline-offset-4 hover:underline"
            >
              View my tower in Applicants City →
            </Link>
          </div>
        )}

        {/* Editable profile fields */}
        <form
          data-testid="profile-edit-form"
          onSubmit={saveProfile}
          className="mt-6 glass rounded-3xl p-7 space-y-5"
        >
          <div>
            <div className="label-mono">EDIT PROFILE</div>
            <h2 className="text-xl font-bold mt-1">Title, skills & resume</h2>
            <p className="text-white/60 text-sm mt-1">
              Everything below is optional. Update what you want, click save.
            </p>
          </div>

          <div>
            <Label className="label-mono text-white/50">TITLE</Label>
            <Input
              data-testid="profile-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
              className="mt-1 bg-black/40 border-white/10 text-white"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TITLE_SUGGESTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTitle(s)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="label-mono text-white/50">EXPERIENCE</Label>
            <div className="mt-2 flex gap-2">
              {[
                { v: "entry", label: "ENTRY" },
                { v: "mid", label: "MID" },
                { v: "senior", label: "SENIOR" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  data-testid={`profile-exp-${opt.v}-btn`}
                  onClick={() => setExperience(opt.v)}
                  className={`px-4 py-2 rounded-full text-xs font-mono tracking-widest border transition ${
                    experience === opt.v
                      ? "bg-[#00FFCC] text-black border-[#00FFCC]"
                      : "bg-transparent border-white/15 text-white/70 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="label-mono text-white/50">SKILLS</Label>
            <div className="mt-1 bg-black/40 border border-white/10 rounded-md px-2 py-1.5 min-h-[44px] flex flex-wrap gap-1.5 items-center">
              {skills.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#00FFCC]/15 text-[#00FFCC] border border-[#00FFCC]/30 flex items-center gap-1.5"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter((x) => x !== s))}
                    className="text-[#00FFCC]/70 hover:text-white"
                    aria-label={`Remove ${s}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                data-testid="profile-skill-input"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={onSkillKey}
                onBlur={() => {
                  addSkill(skillInput);
                  setSkillInput("");
                }}
                placeholder={skills.length ? "" : "React, FastAPI, ML… (Enter to add)"}
                className="flex-1 min-w-[140px] bg-transparent outline-none text-white text-sm placeholder:text-white/30 py-1"
              />
            </div>
          </div>

          <div>
            <Label className="label-mono text-white/50">RESUME LINK</Label>
            <Input
              data-testid="profile-resume-input"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https:// · Google Drive, Notion, personal site…"
              className="mt-1 bg-black/40 border-white/10 text-white"
            />
          </div>

          <div>
            <Button
              data-testid="profile-save-btn"
              type="submit"
              disabled={savingProfile}
              className="btn-applicants rounded-full px-6"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>

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
