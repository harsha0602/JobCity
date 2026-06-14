"""Applicant routes including the 3D buildings payload and compare."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from auth_utils import get_current_user
from db import get_db

router = APIRouter(prefix="/api", tags=["applicants"])

# Pre-determined deterministic grid layout (max 256 slots, hash-based)
GRID_SIZE = 24  # 24x24 = 576 slots


def _slot_for(seed: int) -> tuple[int, int]:
    x = (seed % GRID_SIZE) - GRID_SIZE // 2
    z = ((seed // GRID_SIZE) % GRID_SIZE) - GRID_SIZE // 2
    return x, z


@router.get("/applicants")
async def list_applicants(
    q: Optional[str] = None,
    experience_level: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    db = get_db()
    query: dict = {}
    if experience_level:
        query["experience_level"] = experience_level
    if q:
        query["$or"] = [
            {"display_name": {"$regex": q, "$options": "i"}},
            {"headline": {"$regex": q, "$options": "i"}},
            {"skills": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.applicants.find(query, {"_id": 0}).sort("applications_count", -1).skip(offset).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.applicants.count_documents(query)
    return {"items": items, "total": total}


@router.get("/applicants/{applicant_id}")
async def get_applicant(applicant_id: str):
    db = get_db()
    applicant = await db.applicants.find_one({"applicant_id": applicant_id}, {"_id": 0})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    apps = (
        await db.applications.find({"applicant_id": applicant_id}, {"_id": 0})
        .sort("applied_at", -1)
        .limit(50)
        .to_list(length=50)
    )
    return {"applicant": applicant, "applications": apps}


@router.get("/applicants-city/buildings")
async def applicants_city_buildings():
    """Return the 3D grid data for the Applicants City."""
    db = get_db()
    cursor = db.applicants.find(
        {},
        {
            "_id": 0,
            "applicant_id": 1,
            "display_name": 1,
            "applications_count": 1,
            "experience_level": 1,
            "github_username": 1,
            "github_commits_30d": 1,
            "building_seed": 1,
            "avatar_url": 1,
        },
    )
    items = await cursor.to_list(length=2000)
    out = []
    for a in items:
        seed = int(a.get("building_seed") or 0)
        x, z = _slot_for(seed)
        out.append(
            {
                "id": a["applicant_id"],
                "display_name": a.get("display_name", "Anon"),
                "floors": max(int(a.get("applications_count", 0) or 0), 1),
                "experience_level": a.get("experience_level", "entry"),
                "has_github": bool(a.get("github_username")),
                "github_commits_30d": int(a.get("github_commits_30d", 0) or 0),
                "grid_x": x,
                "grid_z": z,
                "avatar_url": a.get("avatar_url", ""),
            }
        )
    return {"applicants": out, "grid_size": GRID_SIZE}


class CompareIn(BaseModel):
    ids: list[str]


class GithubLinkIn(BaseModel):
    github_username: str


@router.post("/applicants/me/github")
async def link_github(body: GithubLinkIn, request: Request):
    """Link a GitHub username + fetch public commit count (no OAuth needed)."""
    user = await get_current_user(request)
    db = get_db()
    applicant = await db.applicants.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not applicant:
        raise HTTPException(status_code=400, detail="No applicant profile")

    from services.github import fetch_public_commits_30d
    commits, err = await fetch_public_commits_30d(body.github_username)
    update = {
        "github_username": body.github_username.strip().lstrip("@") or None,
        "github_commits_30d": commits,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.applicants.update_one({"applicant_id": applicant["applicant_id"]}, {"$set": update})
    return {"ok": True, "github_username": update["github_username"], "github_commits_30d": commits, "warning": err}


@router.post("/applicants/me/github/sync")
async def sync_github(request: Request):
    """Refresh commit count for the logged-in user's currently-linked GitHub username."""
    user = await get_current_user(request)
    db = get_db()
    applicant = await db.applicants.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not applicant or not applicant.get("github_username"):
        raise HTTPException(status_code=400, detail="Link a GitHub username first")
    from services.github import fetch_public_commits_30d
    commits, err = await fetch_public_commits_30d(applicant["github_username"])
    await db.applicants.update_one(
        {"applicant_id": applicant["applicant_id"]},
        {"$set": {"github_commits_30d": commits, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "github_commits_30d": commits, "warning": err}


@router.post("/applicants/compare")
async def compare_applicants(body: CompareIn):
    if not body.ids or len(body.ids) > 4:
        raise HTTPException(status_code=400, detail="Compare 1–4 applicants")
    db = get_db()
    items = []
    for aid in body.ids:
        a = await db.applicants.find_one({"applicant_id": aid}, {"_id": 0})
        if not a:
            continue
        apps_total = a.get("applications_count", 0)
        by_company = await db.applications.aggregate(
            [
                {"$match": {"applicant_id": aid}},
                {"$group": {"_id": "$company_name", "n": {"$sum": 1}}},
                {"$sort": {"n": -1}},
                {"$limit": 5},
            ]
        ).to_list(length=5)
        items.append(
            {
                "applicant": a,
                "stats": {
                    "applications_count": apps_total,
                    "github_commits_30d": int(a.get("github_commits_30d", 0) or 0),
                    "top_companies": [{"name": r["_id"], "count": r["n"]} for r in by_company],
                },
            }
        )
    return {"items": items}
