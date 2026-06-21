"""Ingestion orchestrator.

Fetches every company in parallel through the right ATS adapter, normalizes
the payload, and upserts into MongoDB (`jobs` + `companies` collections).

Jobs not seen in this run get ``is_active=False`` so they drop out of the
3D scene without us doing destructive deletes.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List

import httpx

from db import get_db
from ingest.adapters import ashby, greenhouse, lever, recruitee, workable
from ingest.companies import COMPANIES
from ingest.normalize import NormalizedJob, company_id_for

_ADAPTERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "workable": workable.fetch,
    "recruitee": recruitee.fetch,
}

_log = logging.getLogger("ingest")


async def _fetch_one(company: dict, client: httpx.AsyncClient) -> List[NormalizedJob]:
    fetch = _ADAPTERS.get(company["source"])
    if not fetch:
        _log.warning("No adapter for source=%s slug=%s", company["source"], company["slug"])
        return []
    try:
        jobs = await fetch(company, client)
        _log.info(
            "[%s/%s] %d jobs", company["source"], company["slug"], len(jobs)
        )
        return jobs
    except httpx.HTTPStatusError as e:
        _log.warning(
            "[%s/%s] HTTP %s — slug likely invalid; skipping",
            company["source"],
            company["slug"],
            e.response.status_code,
        )
        return []
    except (httpx.HTTPError, ValueError) as e:
        _log.warning(
            "[%s/%s] fetch failed: %s — skipping", company["source"], company["slug"], e
        )
        return []


async def _upsert_jobs(db, jobs: List[NormalizedJob]) -> Dict[str, int]:
    """Upsert each job by job_id. Returns {inserted, updated} counters."""
    inserted = 0
    updated = 0
    for j in jobs:
        res = await db.jobs.update_one(
            {"job_id": j["job_id"]},
            {"$set": j},
            upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1
        elif res.modified_count:
            updated += 1
    return {"inserted": inserted, "updated": updated}


async def _upsert_companies(db, companies: List[dict], job_counts: Dict[str, int]) -> int:
    """Persist the companies registry. Schema mirrors the legacy seed but adds source/slug."""
    n = 0
    now = datetime.now(timezone.utc).isoformat()
    for c in companies:
        cid = company_id_for(c["name"])
        count = job_counts.get(c["name"], 0)
        if count == 0:
            continue  # skip companies that returned nothing this run
        await db.companies.update_one(
            {"company_id": cid},
            {
                "$set": {
                    "company_id": cid,
                    "name": c["name"],
                    "color": c.get("color", "#5B8DEF"),
                    "source": c["source"],
                    "slug": c["slug"],
                    "fallback_city": c.get("fallback_city"),
                    "active_jobs": count,
                    "last_ingested_at": now,
                }
            },
            upsert=True,
        )
        n += 1
    return n


async def _expire_stale_jobs(db, run_started: datetime) -> int:
    """Mark jobs that haven't been refreshed this run as inactive.

    Two safety nets:
      * Only touches jobs that were previously active.
      * Compares against `ingested_at` so a slow ingest doesn't wipe everything.
    """
    cutoff_iso = run_started.isoformat()
    res = await db.jobs.update_many(
        {"is_active": True, "ingested_at": {"$lt": cutoff_iso}},
        {"$set": {"is_active": False}},
    )
    return res.modified_count


async def run_ingest(only_sources: list[str] | None = None) -> dict:
    """Top-level ingest. Returns a summary dict (also written to ingest_runs collection)."""
    db = get_db()
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()
    run_started_iso = started.isoformat()

    cos = [
        c for c in COMPANIES if not only_sources or c["source"] in only_sources
    ]
    _log.info("Ingest starting: %d companies, sources=%s", len(cos), only_sources or "all")

    # Fetch all in parallel (bounded). Each request is independent.
    async with httpx.AsyncClient(
        headers={"User-Agent": "JobCity-Ingest/1.0 (+https://github.com/vamshin24/JobCity)"},
        timeout=20.0,
    ) as client:
        sem = asyncio.Semaphore(8)

        async def _bounded(co):
            async with sem:
                return co, await _fetch_one(co, client)

        results = await asyncio.gather(*(_bounded(c) for c in cos))

    all_jobs: List[NormalizedJob] = []
    per_company_count: Dict[str, int] = {}
    for co, jobs in results:
        all_jobs.extend(jobs)
        per_company_count[co["name"]] = len(jobs)

    # Persist
    job_stats = await _upsert_jobs(db, all_jobs)
    co_count = await _upsert_companies(db, cos, per_company_count)
    # Safety: a fully-failed run (0 jobs fetched — e.g. the host IP got
    # rate-limited/blocked) must NOT deactivate every job and empty the city.
    expired = await _expire_stale_jobs(db, started) if all_jobs else 0

    elapsed_s = round(time.monotonic() - t0, 2)
    summary = {
        "run_started_at": run_started_iso,
        "elapsed_s": elapsed_s,
        "companies_attempted": len(cos),
        "companies_with_jobs": co_count,
        "jobs_fetched": len(all_jobs),
        "jobs_inserted": job_stats["inserted"],
        "jobs_updated": job_stats["updated"],
        "jobs_expired": expired,
        "sources": only_sources or sorted(_ADAPTERS.keys()),
    }
    await db.ingest_runs.insert_one({**summary})
    _log.info("Ingest complete: %s", summary)
    return summary
