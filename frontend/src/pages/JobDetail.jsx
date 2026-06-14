import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";

export default function JobDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [coverNote, setCoverNote] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [match, setMatch] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchErr, setMatchErr] = useState("");

  useEffect(() => {
    api.get(`/jobs/${id}`).then((r) => setData(r.data)).catch(() => setData("404"));
  }, [id]);

  const onApply = async () => {
    if (!user || user === false) {
      nav("/login", { state: { returnTo: `/jobs/${id}` } });
      return;
    }
    setApplying(true);
    try {
      await api.post("/applications", { job_id: id, cover_note: coverNote });
      setApplied(true);
      toast.success("Application submitted! Your building grew a floor.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setApplying(false);
    }
  };

  const onMatchScore = async () => {
    if (!user || user === false) {
      nav("/login", { state: { returnTo: `/jobs/${id}` } });
      return;
    }
    setMatching(true);
    setMatchErr("");
    try {
      const { data } = await api.post(`/jobs/${id}/match-score`);
      setMatch(data.match);
    } catch (e) {
      setMatchErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setMatching(false);
    }
  };

  if (data === "404") {
    return <div className="pt-32 text-center text-white/60">Job not found.</div>;
  }
  if (!data) {
    return <div className="pt-32 text-center text-white/60 label-mono">LOADING…</div>;
  }

  const { job, company } = data;

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <Toaster theme="dark" position="top-right" />
      <div className="max-w-3xl mx-auto">
        <Link to="/jobs-city" className="label-mono text-white/40 hover:text-white">← BACK TO JOBS CITY</Link>
        <div className="mt-6 glass rounded-3xl p-7">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center font-[Unbounded] text-2xl font-black"
              style={{ background: job.company_color, color: "#0b0b0b" }}
              data-testid="company-color-block"
            >
              {job.company_name[0]}
            </div>
            <div className="flex-1">
              <div className="label-mono" style={{ color: job.company_color }}>
                {job.city.toUpperCase()}, {job.state} {job.remote && "· REMOTE OK"}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">{job.title}</h1>
              <div className="text-white/70 mt-1">
                at <span className="font-semibold">{job.company_name}</span>
                {company && company.industry && <span className="text-white/40"> · {company.industry}</span>}
              </div>
            </div>
          </div>

          {(job.salary_min || job.salary_max) && (
            <div className="mt-5 font-mono text-sm text-[#FFB24C]">
              {job.salary_min && `$${Math.round(job.salary_min / 1000)}K`} –{" "}
              {job.salary_max && `$${Math.round(job.salary_max / 1000)}K`} / year
            </div>
          )}

          <div className="mt-6 text-white/80 leading-relaxed whitespace-pre-line">{job.description}</div>

          <div className="mt-6 label-mono text-white/40">SOURCE · {job.source.toUpperCase()}</div>
          {job.source_url && (
            <a className="text-sm text-[#00FFCC] underline" href={job.source_url} target="_blank" rel="noreferrer">
              View original post →
            </a>
          )}
        </div>

        <div className="mt-6 glass rounded-3xl p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="label-mono text-[#00FFCC]">AI MATCH · CLAUDE SONNET 4.5</div>
              <h2 className="text-xl font-bold mt-1">How well do you fit this role?</h2>
              <p className="text-white/60 text-sm mt-1">Get a brutally-honest 0–100 score with strengths and gaps in ~3 seconds.</p>
            </div>
            <Button
              data-testid="match-score-btn"
              onClick={onMatchScore}
              disabled={matching}
              className="btn-applicants rounded-full"
              size="sm"
            >
              {matching ? "Scoring…" : match ? "Re-score" : "Score me →"}
            </Button>
          </div>
          {matchErr && <div data-testid="match-error" className="mt-3 text-sm text-[#FF3B30]">{matchErr}</div>}
          {match && (
            <div data-testid="match-result" className="mt-5 rise">
              <div className="flex items-center gap-5">
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center font-[Unbounded] text-3xl font-black"
                  style={{
                    background:
                      match.score >= 70
                        ? "#00FFCC"
                        : match.score >= 40
                        ? "#FFB24C"
                        : "#FF5F6D",
                    color: "#0b0b0b",
                  }}
                  data-testid="match-score-value"
                >
                  {match.score}
                </div>
                <div className="flex-1">
                  <div className="label-mono">RATIONALE</div>
                  <p className="text-white/80 text-sm mt-1">{match.rationale}</p>
                </div>
              </div>
              {match.strengths?.length > 0 && (
                <div className="mt-5">
                  <div className="label-mono text-[#00FFCC]">STRENGTHS</div>
                  <ul className="mt-2 space-y-1 text-sm text-white/80">
                    {match.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2"><span className="text-[#00FFCC]">+</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {match.gaps?.length > 0 && (
                <div className="mt-4">
                  <div className="label-mono text-[#FF5F6D]">GAPS</div>
                  <ul className="mt-2 space-y-1 text-sm text-white/80">
                    {match.gaps.map((g, i) => (
                      <li key={i} className="flex gap-2"><span className="text-[#FF5F6D]">−</span><span>{g}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 glass rounded-3xl p-7">
          <div className="label-mono">APPLY · 1 CLICK</div>
          <h2 className="text-xl font-bold mt-1">Send your application</h2>
          {applied ? (
            <div className="mt-4 text-[#39FF14]" data-testid="applied-success">
              ✓ Applied. Your building in Applicants City just grew a floor.
            </div>
          ) : (
            <>
              <Textarea
                data-testid="cover-note-input"
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="Optional cover note…"
                className="mt-4 bg-black/40 border-white/10 text-white"
                rows={4}
              />
              <Button
                data-testid="apply-btn"
                disabled={applying}
                onClick={onApply}
                className="btn-jobs mt-4 rounded-full px-7 py-6 h-auto text-base"
              >
                {applying ? "Submitting…" : user && user !== false ? "Apply now →" : "Sign in to apply →"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
