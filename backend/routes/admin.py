"""Admin / seed / ingestion routes."""
from fastapi import APIRouter, HTTPException

from db import get_db
from scripts.seed import run_seed
from services.ingestion import ingest_remoteok, ingest_greenhouse

router = APIRouter(prefix="/api/admin", tags=["admin"])


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
