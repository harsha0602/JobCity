"""Admin routes.

Every route is gated by ``require_admin`` — either an admin-role JWT or a valid
``X-Admin-Key`` header. There is intentionally no data-seeding endpoint: jobs are
fetched live from real ATS APIs via ``ingest.runner.run_ingest`` (CLI:
``python -m ingest.cli run``), and the admin account is bootstrapped out-of-band
via ``python -m scripts.seed`` (env-gated).
"""
from fastapi import APIRouter, Depends

from auth_utils import require_admin
from db import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/ingest")
async def ingest_endpoint(source: str | None = None):
    """Trigger a real ATS ingest run. Optionally limit to one source
    (greenhouse|lever|ashby|workable|recruitee)."""
    from ingest.runner import run_ingest

    summary = await run_ingest(only_sources=[source] if source else None)
    return {"ok": True, "summary": summary}


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
