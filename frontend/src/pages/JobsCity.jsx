import { Suspense, useCallback, useEffect, useState } from "react";
import JobsCityScene from "@/components/three/JobsCityScene";
import { api } from "@/lib/api";
import JobDetailPopup from "@/components/JobDetailPopup";
import { Input } from "@/components/ui/input";
import { project } from "@/lib/projection";
import { floorsToHeight } from "@/lib/buildingTex";
import { toast } from "sonner";

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

  // Cold-start / empty-data guard: `cities` is null while loading, then an
  // array (possibly company-less) once loaded. Show a friendly overlay instead
  // of a blank 3D map so a fresh deploy never reads as broken.
  const buildingCount =
    cities == null ? null : cities.reduce((n, c) => n + (c.companies?.length || 0), 0);

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

      {(buildingCount === null || buildingCount === 0) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-2xl px-6 py-5 text-center max-w-sm pointer-events-auto">
            <div className="label-mono text-white/60">JOBS CITY</div>
            {buildingCount === null ? (
              <div className="text-white font-semibold mt-1">Loading the city…</div>
            ) : (
              <>
                <div className="text-white font-semibold mt-1">No open roles loaded yet</div>
                <div className="text-white/50 text-sm mt-1">
                  Live jobs refresh every 6 hours. Check back shortly.
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

      <JobDetailPopup
        company={selected}
        jobs={jobs}
        loading={loadingJobs}
        query={query}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
