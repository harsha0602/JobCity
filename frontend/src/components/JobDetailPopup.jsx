import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Floating, NON-MODAL popup that shows the open roles for a selected company.
 *
 * Mirrors ApplicantSidePanel: a plain absolutely-positioned panel with
 * `pointer-events-auto` and NO full-screen overlay. This is deliberate —
 * the previous implementation used a modal Radix <Sheet> whose overlay
 * (`fixed inset-0`) captured every pointer event and froze the 3D map
 * (no orbit/pan/zoom) while it was open. Keeping this panel non-modal lets
 * the user keep navigating Jobs City while a company's jobs are shown,
 * matching Applicants City.
 */
export default function JobDetailPopup({ company, jobs = [], loading = false, query = "", onClose }) {
  // ESC closes the popup (parity with Applicants City).
  useEffect(() => {
    if (!company) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [company, onClose]);

  if (!company) return null;

  const visibleJobs = jobs.filter(
    (j) =>
      !query ||
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      j.company_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      data-testid="job-detail-popup"
      className="pointer-events-auto fixed top-20 right-4 z-30 w-[360px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-120px)] flex flex-col rounded-xl bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 text-white animate-in fade-in slide-in-from-right-4 duration-300"
    >
      <button
        onClick={onClose}
        data-testid="popup-close-btn"
        className="absolute top-3 right-3 label-mono text-white/40 hover:text-white text-[10px] tracking-widest"
      >
        ESC ×
      </button>

      <div className="px-5 pt-6 pb-2">
        <div className="label-mono" style={{ color: company.color }}>
          {company.city.toUpperCase()}, {company.state}
        </div>
        <div className="font-[Unbounded] text-2xl font-black text-white mt-1 pr-8 break-words">
          {company.name}
        </div>
        <div className="font-mono text-xs text-white/60 mt-1">
          {company.floors} OPEN ROLES IN {company.city.toUpperCase()}
        </div>
      </div>

      <div className="px-5 pb-2 mt-2 space-y-3 overflow-y-auto">
        {loading && <div className="text-white/40 text-sm">Loading jobs…</div>}
        {!loading && visibleJobs.length === 0 && (
          <div className="text-white/40 text-sm">No jobs found.</div>
        )}
        {visibleJobs.map((j) => (
          <Link
            key={j.job_id}
            to={`/jobs/${j.job_id}`}
            data-testid={`job-row-${j.job_id}`}
            className="block glass rounded-xl p-3 hover:bg-white/5 transition"
          >
            <div className="font-semibold text-sm">{j.title}</div>
            <div className="font-mono text-[11px] text-white/50 mt-0.5">
              {j.city}, {j.state} · {j.remote ? "REMOTE OK" : "ONSITE"}
            </div>
            {j.salary_min && (
              <div className="font-mono text-[11px] text-[#FFB24C] mt-1">
                ${Math.round(j.salary_min / 1000)}K – ${Math.round(j.salary_max / 1000)}K
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="px-5 py-4 mt-auto">
        <Button
          data-testid="close-sheet-btn"
          variant="ghost"
          onClick={onClose}
          className="text-white/70"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
