import { Suspense, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import JobsCityScene from "@/components/three/JobsCityScene";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { project } from "@/lib/projection";
import { floorsToHeight } from "@/lib/buildingTex";
import { toast } from "sonner";

const SKYSCRAPER_FLOOR_THRESHOLD = 8;

// Mirror the spiral layout used inside CompanyBuildings so we can fly the
// camera to the *exact* tower of a chosen company from outside the scene.
function computeBuildingsFlat(cities) {
  const out = [];
  if (!cities) return out;
  for (const c of cities) {
    const [cx, cz] = project(c.lat, c.lng);
    const sorted = [...c.companies].sort((a, b) => b.floors - a.floors);
    sorted.forEach((co, i) => {
      const angle = i * 2.39996;
      const r = i === 0 ? 0 : Math.sqrt(i) * 2.2;
      const x = cx + r * Math.cos(angle);
      const z = cz + r * Math.sin(angle);
      const height = floorsToHeight(co.floors, { unit: 1.8, base: 1.2 });
      out.push({
        ...co,
        city: c.city,
        state: c.state,
        x,
        z,
        height,
        key: `${c.city}-${co.id}-${i}`,
      });
    });
  }
  return out;
}

export default function JobsCityPage() {
  const [selected, setSelected] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  useEffect(() => {
    if (!selected) return;
    setLoadingJobs(true);
    api
      .get("/jobs", {
        params: { company_id: selected.id, city: selected.city, state: selected.state, limit: 50 },
      })
      .then((r) => setJobs(r.data.items))
      .finally(() => setLoadingJobs(false));
  }, [selected]);

  const handleCompanyClick = (b) => {
    setSelected(b);
    setFlyTarget([b.x, b.z, "close", Date.now()]);
  };

  const handleCitiesLoaded = useCallback((c) => setCities(c), []);

  // ESC closes the side panel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Enter → find first matching company across cities, fly + open panel
  const onSearchSubmit = (e) => {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    if (!cities) {
      toast.info("Still loading city data…");
      return;
    }
    const buildings = computeBuildingsFlat(cities);
    const match = buildings.find((b) => {
      const fields = [b.name, b.city, b.state].map((s) => String(s).toLowerCase());
      return fields.some((f) => f.includes(q));
    });
    if (!match) {
      toast.error(`No company found matching "${query}".`);
      return;
    }
    toast.success(`Flying to ${match.name} · ${match.city}.`);
    setSelected(match);
    setFlyTarget([match.x, match.z, "close", Date.now()]);
    setQuery("");
  };

  return (
    <div className="fixed inset-0">
      <Suspense fallback={null}>
        <JobsCityScene
          onCompanyClick={handleCompanyClick}
          selected={selected}
          query={query}
          flyTarget={flyTarget}
          onCitiesLoaded={handleCitiesLoaded}
        />
      </Suspense>

      {/* Floating search */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <div className="glass rounded-full p-1 flex items-center pl-4 w-[320px]">
          <Input
            data-testid="jobs-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchSubmit}
            placeholder="Search city, company, role… (Enter to fly)"
            className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Bottom legend */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto glass rounded-2xl px-4 py-3 max-w-sm">
        <div className="label-mono">JOBS CITY · GUIDE</div>
        <div className="text-sm text-white/70 mt-1">
          Each building is a company hiring in that city. Building height = number of open jobs.
          <span className="text-white/40"> Drag to orbit · scroll to zoom · click a tower · Enter to fly.</span>
        </div>
      </div>

      <CompanySidePanel
        company={selected}
        jobs={jobs}
        loadingJobs={loadingJobs}
        query={query}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CompanySidePanel({ company, jobs, loadingJobs, query, onClose }) {
  if (!company) return null;
  const filteredJobs = jobs.filter(
    (j) =>
      !query ||
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      j.company_name.toLowerCase().includes(query.toLowerCase())
  );
  const isSkyscraper = company.floors >= SKYSCRAPER_FLOOR_THRESHOLD;

  return (
    <div
      data-testid="job-detail-panel"
      className="pointer-events-auto fixed top-20 right-4 z-30 w-[360px] max-h-[calc(100vh-100px)] overflow-y-auto rounded-xl bg-[#1a0a14]/95 backdrop-blur-2xl border text-white animate-in fade-in slide-in-from-right-4 duration-300"
      style={{ borderColor: `${company.color}33` }}
    >
      <button
        onClick={onClose}
        data-testid="company-panel-close-btn"
        className="absolute top-3 right-3 label-mono text-white/40 hover:text-white text-[10px] tracking-widest"
      >
        ESC ×
      </button>

      <div className="px-5 pt-6 pb-5">
        <div className="label-mono" style={{ color: company.color }}>
          {company.city.toUpperCase()}, {company.state}
        </div>
        <div className="font-[Unbounded] text-2xl font-black mt-1 leading-tight">
          {company.name}
        </div>
        <div className="font-mono text-xs text-white/60 mt-2">
          {company.floors} OPEN {company.floors === 1 ? "ROLE" : "ROLES"} IN {company.city.toUpperCase()}
          {isSkyscraper && " · SKYSCRAPER"}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: company.color, boxShadow: `0 0 8px ${company.color}` }}
          />
          <span className="font-mono text-[10px] tracking-widest text-white/45 uppercase">
            COMPANY · {company.floors} {company.floors === 1 ? "ROLE" : "ROLES"}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-2.5">
        <div className="label-mono text-white/45 mb-1">OPEN ROLES</div>
        {loadingJobs && <div className="text-white/40 text-sm font-mono">Loading…</div>}
        {!loadingJobs && filteredJobs.length === 0 && (
          <div className="text-white/40 text-sm font-mono">No jobs found.</div>
        )}
        {filteredJobs.map((j) => (
          <Link
            key={j.job_id}
            to={`/jobs/${j.job_id}`}
            data-testid={`job-row-${j.job_id}`}
            className="block rounded-lg p-3 hover:bg-white/5 transition border border-white/5"
          >
            <div className="font-semibold text-sm leading-snug">{j.title}</div>
            <div className="font-mono text-[11px] text-white/50 mt-0.5">
              {j.city}, {j.state} · {j.remote ? "REMOTE OK" : "ONSITE"}
            </div>
            {j.salary_min && (
              <div className="font-mono text-[11px] mt-1" style={{ color: "#FFB24C" }}>
                ${Math.round(j.salary_min / 1000)}K – ${Math.round(j.salary_max / 1000)}K
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="px-5 pb-5">
        <Button
          data-testid="close-panel-btn"
          variant="ghost"
          onClick={onClose}
          className="w-full text-white/70 hover:bg-white/5"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
