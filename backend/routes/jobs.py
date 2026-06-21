"""Job-related routes including the 3D buildings aggregation."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from auth_utils import get_current_user
from data.us_cities import lookup as city_lookup
from db import get_db
from ingest.classify import ALL_CATEGORIES, TECHNICAL_IC
from routes._search import literal_regex

router = APIRouter(prefix="/api", tags=["jobs"])


def _build_category_filter(category: Optional[str]) -> Optional[dict]:
    """Translate a `?category=` query into a Mongo `{$in: [...]}` clause.

    Single source of truth for the category gate so /jobs and
    /jobs-city/buildings can't drift apart.

      - Omitted / blank   → default to TECHNICAL_IC (software + robotics + ml + data + security + infra + hardware)
      - "all"             → ``None`` (caller skips the filter)
      - CSV list          → only the values that pass validation; if none survive,
                            we still default to TECHNICAL_IC so callers can't
                            silently bypass the gate with garbage input.
    """
    if not category:
        return {"$in": sorted(TECHNICAL_IC)}
    if category.strip().lower() == "all":
        return None
    cats = [c.strip().lower() for c in category.split(",") if c.strip()]
    cats = [c for c in cats if c in ALL_CATEGORIES]
    if not cats:
        # Every supplied value was invalid → don't open the gate. Re-apply
        # the technical-IC default so manager/sales/PM roles can't leak in.
        return {"$in": sorted(TECHNICAL_IC)}
    return {"$in": cats}


@router.get("/jobs")
async def list_jobs(
    city: Optional[str] = None,
    state: Optional[str] = None,
    company_id: Optional[str] = None,
    remote: Optional[bool] = None,
    q: Optional[str] = None,
    role: Optional[str] = None,
    tech: Optional[str] = Query(
        None,
        description="Comma-separated tech stack tags; matches ANY (e.g. 'React,Python').",
    ),
    level: Optional[str] = Query(
        None, description="entry | mid | senior (case-insensitive)."
    ),
    posted_within: Optional[str] = Query(
        None,
        description="e.g. '24h', '7d', '30d' — only jobs posted within that window.",
    ),
    source: Optional[str] = Query(
        None, description="greenhouse | lever | ashby | workable | recruitee"
    ),
    category: Optional[str] = Query(
        None,
        description=(
            "Comma-separated job-role categories (software, robotics, ml, data, security, "
            "infra, hardware, design, product, management, business). "
            "Defaults to technical IC roles only (excludes managers, sales, PMs, designers). "
            "Pass 'all' to disable filtering."
        ),
    ),
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List active jobs with rich filters.

    All filters compose via AND. `tech` and `category` are OR-of-comma-separated values.

    When `category` is omitted, only **technical IC** roles are returned
    (software / robotics / ml / data / security / infra / hardware). Pass
    ``category=all`` to disable that gate, or specify any subset, e.g.
    ``category=robotics,ml``.
    """
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
    if source:
        query["source"] = source.lower().strip()
    if level:
        lv = level.lower().strip()
        if lv in ("entry", "mid", "senior"):
            query["level"] = lv
    # Category gating — see _build_category_filter for the contract.
    cat_clause = _build_category_filter(category)
    if cat_clause is not None:
        query["category"] = cat_clause
    if role:
        rx = literal_regex(role)
        query["title"] = {"$regex": rx, "$options": "i"}
    if tech:
        tags = [t.strip() for t in tech.split(",") if t.strip()]
        if tags:
            # OR-match the canonical skill name (case-insensitive) against the
            # ingested `skills` array. Composes with other filters via $and.
            query["$and"] = query.get("$and", []) + [
                {
                    "$or": [
                        {"skills": {"$regex": f"^{literal_regex(t)}$", "$options": "i"}}
                        for t in tags
                    ]
                }
            ]
    if posted_within:
        from datetime import datetime, timedelta, timezone
        unit = posted_within.strip().lower()
        delta = None
        try:
            if unit.endswith("h"):
                delta = timedelta(hours=int(unit[:-1]))
            elif unit.endswith("d"):
                delta = timedelta(days=int(unit[:-1]))
            elif unit.endswith("w"):
                delta = timedelta(weeks=int(unit[:-1]))
        except ValueError:
            delta = None
        if delta is not None:
            cutoff = (datetime.now(timezone.utc) - delta).isoformat()
            query["posted_at"] = {"$gte": cutoff}
    if q:
        rx = literal_regex(q)
        or_clause = [
            {"title": {"$regex": rx, "$options": "i"}},
            {"company_name": {"$regex": rx, "$options": "i"}},
            {"description": {"$regex": rx, "$options": "i"}},
        ]
        query["$and"] = query.get("$and", []) + [{"$or": or_clause}]
    cursor = db.jobs.find(query, {"_id": 0}).sort("posted_at", -1).skip(offset).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.jobs.count_documents(query)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/jobs/filters")
async def jobs_filters():
    """Return the currently-available filter values across active jobs.

    Useful for the frontend to populate dropdowns without hardcoding lists.
    """
    db = get_db()
    levels = await db.jobs.distinct("level", {"is_active": True})
    sources = await db.jobs.distinct("source", {"is_active": True})
    cities = await db.jobs.distinct("city", {"is_active": True})
    # Categories with counts (so the frontend can show "(123)" next to each)
    cat_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    cat_rows = await db.jobs.aggregate(cat_pipeline).to_list(length=20)
    categories = [{"name": r["_id"] or "other", "count": r["count"]} for r in cat_rows]
    # Top 40 tech tags by frequency
    pipeline = [
        {"$match": {"is_active": True}},
        {"$unwind": "$skills"},
        {"$group": {"_id": "$skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 40},
    ]
    tech_rows = await db.jobs.aggregate(pipeline).to_list(length=40)
    tech = [{"tag": r["_id"], "count": r["count"]} for r in tech_rows if r["_id"]]
    return {
        "levels": sorted([lv for lv in levels if lv]),
        "sources": sorted([s for s in sources if s]),
        "cities": sorted([c for c in cities if c]),
        "categories": categories,
        "tech": tech,
    }


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    db = get_db()
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = await db.companies.find_one({"company_id": job["company_id"]}, {"_id": 0})
    return {"job": job, "company": company}


@router.get("/jobs-city/buildings")
async def jobs_city_buildings(category: Optional[str] = None):
    """Aggregate active jobs by (city, state) + company. Returns the 3D payload.

    Filters to **technical IC roles only** by default (software, robotics, ml,
    data, security, infra, hardware) so the city isn't crowded with manager /
    sales / talent roles. Pass ``?category=all`` to disable.
    """
    db = get_db()
    match: dict = {"is_active": True}
    cat_clause = _build_category_filter(category)
    if cat_clause is not None:
        match["category"] = cat_clause
    pipeline = [
        {"$match": match},
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
async def job_brief(job_id: str, request: Request):
    """LLM-generated role summary + required/nice-to-have skills. No auth required.
    Cached for 7 days in `job_briefs` collection so we don't re-spend on Claude.
    Rate-limited to 20 calls / 60s per caller (IP, or user_id if signed in)."""
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

    # Only rate-limit on the cache-miss path (cached returns are essentially free).
    from services.rate_limit import enforce_rate_limit
    await enforce_rate_limit(request, key="job_summary", limit=20, window_s=60)

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

    # Rate-limit cache-miss path: 10 fresh AI computations per hour per user.
    from services.rate_limit import enforce_rate_limit
    await enforce_rate_limit(
        request, key="match_score", limit=10, window_s=3600, user_id=user["user_id"]
    )

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
