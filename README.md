# JobCity

> Your job search as a city. Each company is a tower. Each application is a floor.

JobCity gamifies the job search by visualizing every open role as a 3D building
on a map of the US. Real, live jobs — refreshed every 6 hours from public ATS
endpoints (Greenhouse, Lever, Ashby, Workable, Recruitee). No paid APIs, no
keys required.

## Stack

- **Backend:** FastAPI + Motor (async MongoDB) + APScheduler
- **Frontend:** React (CRA + Craco) + React Three Fiber + Tailwind + Radix UI
- **DB:** MongoDB
- **Ingest:** Public ATS JSON endpoints, normalized into one schema

## Getting started

```bash
# 1. Backend env
cp backend/.env.example backend/.env   # or hand-edit MONGO_URL / JWT_SECRET / CORS_ORIGINS

# 2. Install deps
cd backend && pip install -r requirements.txt
cd ../frontend && yarn install --ignore-engines

# 3. Pull real jobs (no fabricated/seed data is created anymore)
cd ../backend
python -m ingest.cli run            # fetches ~3-4k real jobs from public ATSes
python -m scripts.seed              # OPTIONAL: env-gated admin bootstrap (needs ADMIN_EMAIL/ADMIN_PASSWORD)

# 4. Run
uvicorn server:app --reload --port 8001    # backend
cd ../frontend && yarn start               # frontend (http://localhost:3000)
```

There are no built-in demo/admin accounts — register a user in the app, or set
strong `ADMIN_EMAIL`/`ADMIN_PASSWORD` and run `python -m scripts.seed` to create one admin.

### Run the full stack with Docker

```bash
docker compose up --build              # frontend :8080 → backend :8001 → mongo
docker compose exec backend python -m ingest.cli run   # populate real jobs
open http://localhost:8080
```

## Deployment

Deploys as a full-stack app (GitHub Pages can't host the FastAPI backend or
MongoDB). The repo ships:

- **`backend/Dockerfile`**, **`frontend/Dockerfile`** (nginx serves the build and
  reverse-proxies `/api` → backend, so there's one origin and no CORS), and a root
  **`docker-compose.yml`** for local parity.
- **`render.yaml`** — a Render Blueprint: two Docker web services, with **MongoDB
  on Atlas** (set `MONGO_URL`). `JWT_SECRET` is generated; set `CORS_ORIGINS` to the
  frontend URL and `BACKEND_URL` (frontend) to the backend URL.
- **GitHub Actions**: `ci.yml` (clean dependency install + backend/frontend tests +
  image builds, gates `main`), `deploy.yml` (triggers Render deploy hooks only after
  CI passes), `ingest.yml` (re-runs the ingest every 6h against Atlas).

Required production env: `MONGO_URL`, `DB_NAME`, `JWT_SECRET` (≥32 chars), `APP_ENV=production`,
`CORS_ORIGINS` (explicit, not `*`). The app **fails closed** at startup if these are missing/weak.
AI summary/match are **off by default** (`AI_FEATURES_ENABLED=0`); to enable, install
`requirements-ai.txt` and set the flag + `EMERGENT_LLM_KEY`. See `backend/.env.example`.

## How the job ingest works

```
backend/ingest/
├── companies.py          # curated list of ~70 company → ATS-slug pairs
├── adapters/             # one adapter per ATS source
│   ├── greenhouse.py     # boards-api.greenhouse.io
│   ├── lever.py          # api.lever.co/v0/postings
│   ├── ashby.py          # api.ashbyhq.com/posting-api/job-board
│   ├── workable.py       # apply.workable.com/api/v1/widget/accounts
│   └── recruitee.py      # {slug}.recruitee.com/api/offers
├── extract.py            # regex extraction: tech skills, level, salary
├── locations.py          # free-text "San Francisco, CA" → (lat, lng) lookup
├── normalize.py          # common Job shape (TypedDict) + deterministic IDs
└── runner.py             # orchestrator: fetches all in parallel, upserts to mongo
```

### CLI

```bash
python -m ingest.cli verify      # ping every slug, report 404s
python -m ingest.cli run                          # ingest all sources
python -m ingest.cli run --source greenhouse      # ingest only one ATS
```

### Scheduler

`backend/services/scheduler.py` boots an `AsyncIOScheduler` inside the FastAPI
process. It runs `ingest.runner.run_ingest()`:

- **+30s after backend startup** (configurable: `INGEST_STARTUP_DELAY_S`)
- **every 6h** (configurable: `INGEST_INTERVAL_HOURS`)
- **disabled** if `INGEST_SCHEDULER_DISABLED=1`

A job not seen in the latest run gets `is_active=False` (no destructive deletes).

### Adding a company

Open `backend/ingest/companies.py`, append a row:

```python
{"source": "greenhouse", "slug": "your-company", "name": "Your Co",
 "color": "#5B8DEF", "fallback_city": "San Francisco"},
```

Then `python -m ingest.cli verify` to make sure the slug returns 200.

## API: rich filters

`GET /api/jobs` supports:

| Param           | Type     | Example          | Notes                                              |
|-----------------|----------|------------------|----------------------------------------------------|
| `q`             | string   | `?q=infra`       | Substring across title/company/description         |
| `role`          | string   | `?role=Engineer` | Substring against title only                       |
| `tech`          | csv      | `?tech=Python,Rust` | OR-match against extracted skills (canonical names) |
| `level`         | enum     | `?level=senior`  | `entry` \| `mid` \| `senior`                       |
| `posted_within` | duration | `?posted_within=7d` | `Nh` \| `Nd` \| `Nw`                             |
| `source`        | enum     | `?source=ashby`  | Which ATS the job came from                        |
| `city`/`state`  | string   | `?city=Seattle`  | Exact match                                        |
| `remote`        | bool     | `?remote=true`   |                                                    |
| `company_id`    | string   | `?company_id=co_…` | Used by Jobs City side panel                     |

`GET /api/jobs/filters` returns the live facets (levels, sources, cities, top 40 tech tags) so the
frontend can populate dropdowns without hardcoding.

## Rate limits

LLM endpoints (`/jobs/{id}/summary`, `/jobs/{id}/match-score`) are rate-limited
via `services/rate_limit.py`:

- `/summary`: 20 calls / 60s per IP-or-user (cache-miss path only)
- `/match-score`: 10 calls / 3600s per authenticated user (cache-miss path only)

Cached responses bypass the limit entirely.

## Tests

```bash
cd backend
python -m pytest -q
```

Covers ingest extract regexes (tech, level, salary, dates), location parsing,
filter endpoint, auth, rate limits, and applicants/jobs aggregation.

## License & contributing

PRs welcome — especially new company slugs in `companies.py`.
