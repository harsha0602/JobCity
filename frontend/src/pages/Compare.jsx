import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { EXP_COLORS } from "@/lib/colors";

export default function ComparePage() {
  const [params] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ids.length) {
      setItems([]);
      return;
    }
    let ignore = false;
    setError(false);
    api
      .post("/applicants/compare", { ids })
      .then((r) => {
        if (!ignore) setItems(r.data?.items || []);
      })
      .catch(() => {
        if (!ignore) {
          setItems([]);
          setError(true);
        }
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("ids")]);

  if (error)
    return (
      <div className="pt-32 text-center text-white/60 label-mono">
        Couldn&apos;t load the comparison. Please try again.
      </div>
    );
  if (items === null) return <div className="pt-32 text-center text-white/60 label-mono">LOADING…</div>;

  const maxApps = Math.max(1, ...items.map((it) => it.stats.applications_count || 0));
  const maxCommits = Math.max(1, ...items.map((it) => it.stats.github_commits_30d || 0));

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/applicants-city" className="label-mono text-white/40 hover:text-white">
          ← BACK TO APPLICANTS CITY
        </Link>
        <h1 className="text-4xl font-black mt-3">Compare</h1>
        <p className="text-white/60 mt-1">Side-by-side stats for the buildings you tapped.</p>

        <div className={`mt-8 grid gap-5`} style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const a = it.applicant;
            const color = EXP_COLORS[a.experience_level] || EXP_COLORS.entry;
            return (
              <div key={a.applicant_id} className="glass rounded-3xl p-5" data-testid={`compare-card-${a.applicant_id}`}>
                <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center font-[Unbounded] text-xl font-black"
                     style={{ background: color, color: "#0b0b0b" }}>
                  {a.display_name[0]}
                </div>
                <div className="font-bold">{a.display_name}</div>
                <div className="label-mono mt-1" style={{ color }}>
                  {a.experience_level.toUpperCase()}
                </div>
                <Bar label="APPLICATIONS" value={it.stats.applications_count} max={maxApps} color="#00FFCC" />
                <Bar label="COMMITS 30D" value={it.stats.github_commits_30d} max={maxCommits} color="#FF5F6D" />
                <div className="mt-4">
                  <div className="label-mono">TOP COMPANIES</div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {it.stats.top_companies.length === 0 && (
                      <li className="text-white/40">No applications yet.</li>
                    )}
                    {it.stats.top_companies.map((tc) => (
                      <li key={tc.name} className="flex justify-between">
                        <span className="text-white/80">{tc.name}</span>
                        <span className="font-mono text-white/50">{tc.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={`/applicants/${a.applicant_id}`}
                  className="mt-4 inline-block text-sm font-semibold text-[#00FFCC]"
                >
                  Open profile →
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }) {
  const pct = Math.max(2, Math.round(((value || 0) / max) * 100));
  return (
    <div className="mt-4">
      <div className="flex justify-between label-mono">
        <span>{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
