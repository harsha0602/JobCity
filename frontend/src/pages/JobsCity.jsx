import { Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import JobsCityScene from "@/components/three/JobsCityScene";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JobsCityPage() {
  const [selected, setSelected] = useState(null); // {id (company_id), name, city, state, color, floors}
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [query, setQuery] = useState("");

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

  return (
    <div className="fixed inset-0">
      <Suspense fallback={null}>
        <JobsCityScene onCompanyClick={setSelected} selected={selected} query={query} />
      </Suspense>

      {/* Floating search */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <div className="glass rounded-full p-1 flex items-center pl-4 w-[280px]">
          <Input
            data-testid="jobs-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, company, role…"
            className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Bottom legend */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto glass rounded-2xl px-4 py-3 max-w-sm">
        <div className="label-mono">JOBS CITY · GUIDE</div>
        <div className="text-sm text-white/70 mt-1">
          Each building is a company hiring in that city. Building height = number of open jobs.
          <span className="text-white/40"> Drag to orbit · scroll to zoom · click a tower.</span>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          data-testid="job-detail-sheet"
          side="right"
          className="bg-[#0a0a0a]/90 backdrop-blur-2xl border-l border-white/10 text-white w-full sm:max-w-md"
        >
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <div className="label-mono" style={{ color: selected.color }}>
                  {selected.city.toUpperCase()}, {selected.state}
                </div>
                <SheetTitle className="font-[Unbounded] text-3xl font-black text-white">
                  {selected.name}
                </SheetTitle>
                <div className="font-mono text-xs text-white/60 mt-1">
                  {selected.floors} OPEN ROLES IN {selected.city.toUpperCase()}
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-3 overflow-y-auto pr-2 -mr-2 max-h-[70vh]">
                {loadingJobs && <div className="text-white/40 text-sm">Loading jobs…</div>}
                {!loadingJobs && jobs.length === 0 && (
                  <div className="text-white/40 text-sm">No jobs found.</div>
                )}
                {jobs
                  .filter(
                    (j) =>
                      !query ||
                      j.title.toLowerCase().includes(query.toLowerCase()) ||
                      j.company_name.toLowerCase().includes(query.toLowerCase())
                  )
                  .map((j) => (
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
              <div className="mt-4 flex gap-2">
                <Button
                  data-testid="close-sheet-btn"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  className="text-white/70"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
