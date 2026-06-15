import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ApplicantsCityScene from "@/components/three/ApplicantsCityScene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { APPLICANT_CITY_COLORS } from "@/lib/colors";
import { toast } from "sonner";

const SPACING = 2.4;

export default function ApplicantsCityPage() {
  const { applicant: meApplicant } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [applicants, setApplicants] = useState([]);
  const [focus, setFocus] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [query, setQuery] = useState("");
  const [flyTarget, setFlyTarget] = useState(null);
  const autoFlyDoneRef = useRef(false);

  const handleApplicantsLoaded = useCallback((list) => setApplicants(list), []);

  // ESC closes popup
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Camera fly + open panel; pass `zoom` to control how close the camera lands.
  const flyToBuilding = (a, { zoom = "close" } = {}) => {
    const x = a.grid_x * SPACING;
    const z = a.grid_z * SPACING;
    setFlyTarget([x, z, zoom, Date.now()]);
    setFocus(a);
  };

  const onBuildingClick = (a) => flyToBuilding(a, { zoom: "close" });

  const addToCompare = (a) => {
    setCompareIds((prev) => {
      if (prev.includes(a.id)) {
        toast.info("Already in compare set.");
        return prev;
      }
      if (prev.length >= 4) {
        toast.info("Compare set is full (max 4). Remove one first.");
        return prev;
      }
      toast.success(`${a.display_name} added to compare (${prev.length + 1}/4).`);
      return [...prev, a.id];
    });
  };

  const removeFromCompare = (id) =>
    setCompareIds((prev) => prev.filter((x) => x !== id));

  const myBuilding = useMemo(() => {
    if (!meApplicant) return null;
    return applicants.find((a) => a.id === meApplicant.applicant_id);
  }, [applicants, meApplicant]);

  const navigateToMe = useCallback(() => {
    if (!myBuilding) {
      toast.error("Couldn't find your tower yet.");
      return;
    }
    flyToBuilding(myBuilding, { zoom: "medium" });
  }, [myBuilding]);

  // Auto-navigate when ?navigate=me is present and the user's building is loaded
  useEffect(() => {
    if (autoFlyDoneRef.current) return;
    if (searchParams.get("navigate") !== "me") return;
    if (!myBuilding) return;
    autoFlyDoneRef.current = true;
    navigateToMe();
    // Clear query so refresh doesn't repeat the fly
    searchParams.delete("navigate");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, myBuilding, navigateToMe]);

  // Search → find first match, fly to it
  const onSearchSubmit = (e) => {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = applicants.find((a) => {
      const fields = [a.display_name, a.title, a.experience_level, a.has_github ? "github" : ""]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return fields.some((f) => f.includes(q));
    });
    if (!match) {
      toast.error(`No applicant found matching "${query}".`);
      return;
    }
    toast.success(`Found ${match.display_name}.`);
    flyToBuilding(match, { zoom: "close" });
  };

  const idToApplicant = useMemo(() => {
    const m = new Map();
    applicants.forEach((a) => m.set(a.id, a));
    return m;
  }, [applicants]);

  return (
    <div className="fixed inset-0">
      <Suspense fallback={null}>
        <ApplicantsCityScene
          onApplicantClick={onBuildingClick}
          selectedIds={compareIds}
          focusId={focus?.id}
          flyTarget={flyTarget}
          query={query}
          onApplicantsLoaded={handleApplicantsLoaded}
        />
      </Suspense>

      {/* Floating search (Enter to fly to first match) */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <div className="glass rounded-full p-1 flex items-center pl-4 w-[320px]">
          <Input
            data-testid="applicants-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchSubmit}
            placeholder="Search name, title, level… (Enter to fly)"
            className="bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {meApplicant && (
        <div className="absolute top-20 right-4 z-20 pointer-events-auto">
          <Button
            data-testid="navigate-to-my-building-btn"
            onClick={navigateToMe}
            className="rounded-full bg-[#5BE3A3] text-black hover:bg-[#5BE3A3]/90 font-semibold shadow-lg shadow-[#5BE3A3]/20"
          >
            ↗ Navigate to my tower
          </Button>
        </div>
      )}

      <div className="absolute top-36 left-4 z-20 pointer-events-auto glass rounded-2xl px-4 py-3 max-w-md">
        <div className="label-mono text-[#5BE3A3]">APPLICANTS CITY · GUIDE</div>
        <div className="text-sm text-white/70 mt-1">
          Tap a tower to focus. Search and press Enter to fly to a user.
          Use “+ Add to compare” on up to 4 towers.
        </div>
      </div>

      {compareIds.length > 0 && (
        <div
          data-testid="compare-bar"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto glass-strong rounded-3xl px-4 py-3 flex items-center gap-3 flex-wrap max-w-[92vw]"
        >
          <div className="label-mono text-[#5BE3A3]">COMPARE {compareIds.length}/4</div>
          <div className="flex items-center gap-2">
            {compareIds.map((id) => {
              const a = idToApplicant.get(id);
              if (!a) return null;
              const c = APPLICANT_CITY_COLORS[a.experience_level] || APPLICANT_CITY_COLORS.entry;
              return (
                <span
                  key={id}
                  data-testid={`compare-chip-${id}`}
                  className="pl-2 pr-1 py-1 rounded-full flex items-center gap-1.5 bg-black/40 border border-white/10 text-xs font-mono"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: c, boxShadow: `0 0 6px ${c}` }}
                  />
                  {a.display_name}
                  <button
                    onClick={() => removeFromCompare(id)}
                    className="ml-1 w-5 h-5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 leading-none"
                    aria-label="Remove from compare"
                    data-testid={`compare-remove-${id}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          <Button
            data-testid="compare-go-btn"
            disabled={compareIds.length < 2}
            onClick={() => nav(`/compare?ids=${compareIds.join(",")}`)}
            className="btn-applicants rounded-full"
            size="sm"
          >
            Compare side-by-side →
          </Button>
          <Button
            data-testid="compare-clear-btn"
            variant="ghost"
            size="sm"
            onClick={() => setCompareIds([])}
            className="text-white/60"
          >
            Clear
          </Button>
        </div>
      )}

      <ApplicantSidePanel
        applicant={focus}
        onClose={() => setFocus(null)}
        onAddCompare={() => focus && addToCompare(focus)}
        inCompareSet={focus ? compareIds.includes(focus.id) : false}
        compareFull={compareIds.length >= 4}
      />
    </div>
  );
}

function ApplicantSidePanel({ applicant, onClose, onAddCompare, inCompareSet, compareFull }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!applicant) return;
    setDetail(null);
    setLoading(true);
    import("@/lib/api").then(({ api }) =>
      api
        .get(`/applicants/${applicant.id}`)
        .then((r) => setDetail(r.data.applicant))
        .catch(() => setDetail(null))
        .finally(() => setLoading(false))
    );
  }, [applicant]);

  if (!applicant) return null;

  const color = APPLICANT_CITY_COLORS[applicant.experience_level] || APPLICANT_CITY_COLORS.entry;
  const skills = detail?.skills || [];
  const resumeUrl = detail?.resume_url || "";
  const title = (detail?.title || applicant.title || "").toUpperCase();
  const handle = (detail?.github_username || applicant.display_name?.split(" ").join("").toLowerCase() || "user");
  const commits = applicant.github_commits_30d || 0;
  const apps = applicant.floors;

  return (
    <div
      data-testid="applicant-side-panel"
      className="pointer-events-auto fixed top-20 right-4 z-30 w-[340px] max-h-[calc(100vh-100px)] overflow-y-auto rounded-xl bg-[#0a1a10]/95 backdrop-blur-2xl border border-[#5BE3A3]/15 text-white animate-in fade-in slide-in-from-right-4 duration-300"
    >
      {/* Top close + ESC hint */}
      <button
        onClick={onClose}
        data-testid="popup-close-btn"
        className="absolute top-3 right-3 label-mono text-white/40 hover:text-white text-[10px] tracking-widest"
      >
        ESC ×
      </button>

      {/* Header */}
      <div className="px-5 pt-6 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-[Unbounded] text-2xl font-black border-2"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${color}, #0a1a10)`,
              borderColor: color,
              color: "#0b1a10",
              boxShadow: `0 0 24px ${color}66`,
            }}
            data-testid="applicant-avatar-block"
          >
            {applicant.display_name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-[Unbounded] text-lg font-bold tracking-wide uppercase truncate"
              data-testid="applicant-name"
            >
              {applicant.display_name}
            </div>
            <div className="font-mono text-xs text-white/55 truncate">@{handle}</div>
            {title && (
              <div className="font-mono text-[10px] tracking-widest mt-0.5" style={{ color: "#FF6B6B" }}>
                {title}
              </div>
            )}
          </div>
        </div>

        {/* Level bar */}
        <div className="mt-4 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border-2 flex items-center justify-center font-mono text-sm font-bold"
            style={{ borderColor: "#5BE3A3", color: "#5BE3A3" }}
          >
            {apps >= 8 ? "S" : apps >= 4 ? "A" : "B"}
          </div>
          <div className="flex-1">
            <div className="label-mono text-[10px] text-white/50 mb-0.5">
              {applicant.experience_level.toUpperCase()} · {apps >= 8 ? "POWER USER" : "BUILDING UP"}
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(apps * 10, 100)}%`,
                  background: "linear-gradient(90deg, #5BE3A3, #FFD23F)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span
            className="px-2.5 py-1 rounded text-[10px] font-mono tracking-widest uppercase border"
            style={{ borderColor: "#FF6B6B", color: "#FF6B6B", background: "#FF6B6B22" }}
          >
            {applicant.experience_level}
          </span>
          {applicant.has_github && (
            <span className="px-2.5 py-1 rounded text-[10px] font-mono tracking-widest uppercase border border-[#5BE3A3]/40 text-[#5BE3A3] bg-[#5BE3A3]/10">
              GitHub
            </span>
          )}
        </div>

        {/* Stat grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="APPS" value={apps} testid="applicant-applications-count" />
          <StatTile label="COMMITS/30D" value={commits} />
          <StatTile label="SKILLS" value={skills.length || (loading ? "…" : 0)} />
          <StatTile label="LEVEL" value={apps >= 8 ? "S" : apps >= 4 ? "A" : "B"} />
          <StatTile label="STATUS" value={apps >= 8 ? "HOT" : "—"} />
          <StatTile label="HIRABLE" value={skills.length >= 3 ? "YES" : "—"} />
        </div>

        {/* Skills */}
        <div className="mt-4">
          <div className="label-mono text-white/50">SKILLS</div>
          {loading ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <div className="h-5 w-12 bg-white/5 rounded animate-pulse" />
              <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
              <div className="h-5 w-10 bg-white/5 rounded animate-pulse" />
            </div>
          ) : skills.length === 0 ? (
            <div className="mt-1 text-white/40 text-sm">— not provided</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="applicant-skills-list">
              {skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#5BE3A3]/10 text-[#5BE3A3] border border-[#5BE3A3]/30"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2">
          {resumeUrl ? (
            <a
              data-testid="applicant-resume-link"
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded font-mono text-xs tracking-widest uppercase bg-[#FFD23F] text-black hover:bg-[#FFD23F]/90 transition"
            >
              View Resume ↗
            </a>
          ) : (
            <div className="block w-full text-center py-3 rounded font-mono text-xs tracking-widest uppercase bg-white/5 text-white/30 cursor-not-allowed">
              No resume linked
            </div>
          )}
          <Button
            data-testid="add-to-compare-btn"
            onClick={onAddCompare}
            disabled={inCompareSet || compareFull}
            className="w-full rounded font-mono text-xs tracking-widest uppercase bg-transparent border border-white/15 text-white hover:bg-white/5 disabled:opacity-40"
          >
            {inCompareSet ? "In compare" : compareFull ? "Compare full" : "+ Compare"}
          </Button>
          {applicant.has_github && (
            <a
              href={`https://github.com/${detail?.github_username || handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded font-mono text-xs tracking-widest uppercase bg-transparent border border-white/15 text-white hover:bg-white/5"
            >
              GitHub ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
function StatTile({ label, value, testid }) {
  return (
    <div
      className="rounded border border-white/10 bg-black/30 py-2 px-1.5 text-center"
      data-testid={testid}
    >
      <div className="font-mono text-base font-bold text-[#FFD23F] leading-tight">{value}</div>
      <div className="label-mono text-[9px] text-white/45 mt-0.5">{label}</div>
    </div>
  );
}
