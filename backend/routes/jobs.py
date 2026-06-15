"""Job-related routes including the 3D buildings aggregation."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from auth_utils import get_current_user
from data.us_cities import lookup as city_lookup
from db import get_db
from routes._search import literal_regex

router = APIRouter(prefix="/api", tags=["jobs"])


@router.get("/jobs")
async def list_jobs(
    city: Optional[str] = None,
    state: Optional[str] = None,
    company_id: Optional[str] = None,
    remote: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    db = get_db()
    query: dict = {"is_active": True}
    if city:
        query["city"] = city
    if state:
        query["state"] = state
    if company_id:
        query["company_id"] = company_id
    if remote is not None:
        query["remote"] = remote
    if q:
        rx = literal_regex(q)
        query["$or"] = [
            {"title": {"$regex": rx, "$options": "i"}},
            {"company_name": {"$regex": rx, "$options": "i"}},
            {"description": {"$regex": rx, "$options": "i"}},
        ]
    cursor = db.jobs.find(query, {"_id": 0}).sort("posted_at", -1).skip(offset).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.jobs.count_documents(query)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    db = get_db()
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = await db.companies.find_one({"company_id": job["company_id"]}, {"_id": 0})
    return {"job": job, "company": company}


@router.get("/jobs-city/buildings")
async def jobs_city_buildings():
    """Aggregate active jobs by (city, state) + company. Returns the 3D payload."""
    db = get_db()
    pipeline = [
        {"$match": {"is_active": True}},
        {
            "$group": {
                "_id": {
                    "city": "$city",
                    "state": "$state",
                    "company_id": "$company_id",
                    "company_name": "$company_name",
                    "company_color": "$company_color",
                },
                "floors": {"$sum": 1},
            }
        },
        {
            "$group": {
                "_id": {"city": "$_id.city", "state": "$_id.state"},
                "companies": {
                    "$push": {
                        "id": "$_id.company_id",
                        "name": "$_id.company_name",
                        "color": "$_id.company_color",
                        "floors": "$floors",
                    }
                },
                "total_jobs": {"$sum": "$floors"},
            }
        },
    ]
    rows = await db.jobs.aggregate(pipeline).to_list(length=1000)
    out = []
    for r in rows:
        city = r["_id"]["city"]
        state = r["_id"]["state"]
        coords = city_lookup(city, state)
        if not coords:
            continue
        lat, lng = coords
        # Sort companies by floors desc for stable spiral order
        companies = sorted(r["companies"], key=lambda c: (-c["floors"], c["name"]))
        out.append(
            {
                "city": city,
                "state": state,
                "lat": lat,
                "lng": lng,
                "total_jobs": r["total_jobs"],
                "companies": companies,
            }
        )
    out.sort(key=lambda x: -x["total_jobs"])
    return {"cities": out}


@router.get("/jobs/{job_id}/summary")
async def job_brief(job_id: str):
    """LLM-generated role summary + required/nice-to-have skills. No auth required.
    Cached for 7 days in `job_briefs` collection so we don't re-spend on Claude."""
    db = get_db()
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    from datetime import datetime, timezone, timedelta
    cached = await db.job_briefs.find_one({"job_id": job_id}, {"_id": 0})
    if cached:
        try:
            created = datetime.fromisoformat(cached["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - created < timedelta(days=7):
                return {"brief": {k: cached[k] for k in ("summary", "required_skills", "nice_to_have", "seniority")}, "cached": True}
        except Exception:
            pass

    try:
        from services.llm import job_role_brief
        result = await job_role_brief(job=job)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")
    await db.job_briefs.replace_one(
        {"job_id": job_id},
        {
            "job_id": job_id,
            **result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        upsert=True,
    )
    return {"brief": result, "cached": False}


@router.post("/jobs/{job_id}/match-score")
async def match_score(job_id: str, request: Request):
    """LLM-powered match score (Claude Sonnet 4.5 via Emergent LLM key)."""
    user = await get_current_user(request)
    db = get_db()
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    applicant = await db.applicants.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not applicant:
        raise HTTPException(status_code=400, detail="No applicant profile")

    # Cache by (applicant_id, job_id) for 24h to keep costs sane
    from datetime import datetime, timezone, timedelta
    cached = await db.match_scores.find_one(
        {"applicant_id": applicant["applicant_id"], "job_id": job_id}, {"_id": 0}
    )
    if cached:
        try:
            created = datetime.fromisoformat(cached["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - created < timedelta(hours=24):
                return {"match": {k: cached[k] for k in ("score", "rationale", "strengths", "gaps")}, "cached": True}
        except Exception:
            pass

    try:
        from services.llm import job_match_score
        result = await job_match_score(job=job, applicant=applicant)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    await db.match_scores.replace_one(
        {"applicant_id": applicant["applicant_id"], "job_id": job_id},
        {
            "applicant_id": applicant["applicant_id"],
            "job_id": job_id,
            "score": result["score"],
            "rationale": result["rationale"],
            "strengths": result["strengths"],
            "gaps": result["gaps"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        upsert=True,
    )
    return {"match": result, "cached": False}
