"""Admin / seed / ingestion routes.

Every route is gated by ``require_admin`` — either an admin-role JWT or a
valid ``X-Admin-Key`` header. Before this gate existed, anyone could wipe the
database via ``POST /api/admin/seed?reset=true``.
"""
from fastapi import APIRouter, Depends, HTTPException

from auth_utils import require_admin
from db import get_db
from scripts.seed import run_seed
from services.ingestion import ingest_remoteok, ingest_greenhouse

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/seed")
async def seed_endpoint(reset: bool = False):
    db = get_db()
    counts = await run_seed(db, reset=reset)
    return {"ok": True, "counts": counts}


@router.post("/ingest/remoteok")
async def ingest_remoteok_endpoint():
    db = get_db()
    n = await ingest_remoteok(db)
    return {"ok": True, "ingested": n}


@router.post("/ingest/greenhouse")
async def ingest_greenhouse_endpoint(boards: list[str] | None = None):
    db = get_db()
    n = await ingest_greenhouse(db, boards or ["stripe", "airbnb", "vercel", "anthropic", "databricks"])
    return {"ok": True, "ingested": n}


@router.post("/ingest/lever")
async def ingest_lever_endpoint(boards: list[str] | None = None):
    from services.ingestion import ingest_lever
    db = get_db()
    n = await ingest_lever(db, boards or ["palantir", "reddit", "lyft", "stickermule", "kong"])
    return {"ok": True, "ingested": n}


@router.post("/ingest/yc")
async def ingest_yc_endpoint(limit: int = 80):
    from services.ingestion import ingest_yc
    db = get_db()
    n = await ingest_yc(db, limit=limit)
    return {"ok": True, "ingested": n}


@router.get("/scheduler/status")
async def scheduler_status():
    from services.scheduler import state
    return state()


@router.post("/cleanup-categories")
async def cleanup_non_eligible_jobs():
    """One-shot: deactivate any job whose title doesn't match the
    Software / ML / Robotics allowlist. Also stamps a 'category' field on
    every active job for future filtering."""
    from services.job_filter import category as _category
    db = get_db()
    deactivated = 0
    tagged = 0
    cursor = db.jobs.find({}, {"_id": 0, "job_id": 1, "title": 1, "is_active": 1})
    async for j in cursor:
        cat = _category(j.get("title") or "")
        if cat is None:
            if j.get("is_active"):
                await db.jobs.update_one(
                    {"job_id": j["job_id"]}, {"$set": {"is_active": False, "category": None}}
                )
                deactivated += 1
        else:
            await db.jobs.update_one(
                {"job_id": j["job_id"]}, {"$set": {"is_active": True, "category": cat}}
            )
            tagged += 1
    return {"ok": True, "deactivated": deactivated, "tagged": tagged}


@router.get("/stats")
async def stats():
    db = get_db()
    return {
        "users": await db.users.count_documents({}),
        "applicants": await db.applicants.count_documents({}),
        "companies": await db.companies.count_documents({}),
        "jobs": await db.jobs.count_documents({}),
        "active_jobs": await db.jobs.count_documents({"is_active": True}),
        "applications": await db.applications.count_documents({}),
    }
