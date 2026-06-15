"""Applicant routes including the 3D buildings payload and compare."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from auth_utils import get_current_user, get_optional_user
from db import get_db
from routes._search import literal_regex

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
        rx = literal_regex(q)
        query["$or"] = [
            {"display_name": {"$regex": rx, "$options": "i"}},
            {"headline": {"$regex": rx, "$options": "i"}},
            {"skills": {"$regex": rx, "$options": "i"}},
        ]
    cursor = db.applicants.find(query, {"_id": 0}).sort("applications_count", -1).skip(offset).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.applicants.count_documents(query)
    return {"items": items, "total": total}


@router.get("/applicants/{applicant_id}")
async def get_applicant(applicant_id: str, request: Request):
    db = get_db()
    applicant = await db.applicants.find_one({"applicant_id": applicant_id}, {"_id": 0})
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    # Profile is public (the browsable city), but application history (which
    # companies, when) is PII — only expose it to authenticated viewers.
    viewer = await get_optional_user(request)
    apps: list = []
    if viewer is not None:
        apps = (
            await db.applications.find({"applicant_id": applicant_id}, {"_id": 0})
            .sort("applied_at", -1)
            .limit(50)
            .to_list(length=50)
        )
    return {"applicant": applicant, "applications": apps}


@router.get("/applicants-city/buildings")
async def applicants_city_buildings():
    """Return the 3D grid data for the Applicants City.

    If two applicants hash to the same grid slot we spiral outward to the
    nearest free slot so no two towers ever overlap.
    """
    db = get_db()
    cursor = db.applicants.find(
        {},
        {
            "_id": 0,
            "applicant_id": 1,
            "display_name": 1,
            "title": 1,
            "applications_count": 1,
            "experience_level": 1,
            "github_username": 1,
            "github_commits_30d": 1,
            "building_seed": 1,
            "avatar_url": 1,
        },
    )
    items = await cursor.to_list(length=2000)

    # Sort by applications desc so power users land on their original slot
    items.sort(key=lambda a: -int(a.get("applications_count", 0) or 0))

    # Pre-computed spiral offsets (concentric rings of squares)
    spiral: list[tuple[int, int]] = [(0, 0)]
    for r in range(1, GRID_SIZE):
        for dx in range(-r, r + 1):
            spiral.append((dx, -r))
            spiral.append((dx, r))
        for dz in range(-r + 1, r):
            spiral.append((-r, dz))
            spiral.append((r, dz))

    occupied: set[tuple[int, int]] = set()
    half = GRID_SIZE // 2
    out = []
    for a in items:
        seed = int(a.get("building_seed") or 0)
        bx, bz = _slot_for(seed)
        x, z = bx, bz
        for dx, dz in spiral:
            cx, cz = bx + dx, bz + dz
            if cx < -half or cx >= half or cz < -half or cz >= half:
                continue
            if (cx, cz) not in occupied:
                x, z = cx, cz
                break
        occupied.add((x, z))
        out.append(
            {
                "id": a["applicant_id"],
                "display_name": a.get("display_name", "Anon"),
                "title": a.get("title", ""),
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


class ApplicantProfileIn(BaseModel):
    title: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[list[str]] = None
    resume_url: Optional[str] = None
    experience_level: Optional[str] = None


@router.patch("/applicants/me")
async def update_my_profile(body: ApplicantProfileIn, request: Request):
    """Update the logged-in applicant's optional profile fields (title, skills, resume_url, etc)."""
    user = await get_current_user(request)
    db = get_db()
    applicant = await db.applicants.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not applicant:
        raise HTTPException(status_code=400, detail="No applicant profile")

    update: dict = {}
    if body.title is not None:
        update["title"] = body.title.strip()[:80]
    if body.headline is not None:
        update["headline"] = body.headline.strip()[:160]
    if body.skills is not None:
        clean = [s.strip() for s in body.skills if isinstance(s, str) and s.strip()]
        update["skills"] = clean[:25]
    if body.resume_url is not None:
        url = body.resume_url.strip()
        if url and not (url.startswith("http://") or url.startswith("https://")):
            raise HTTPException(status_code=400, detail="Resume URL must start with http:// or https://")
        update["resume_url"] = url
    if body.experience_level in {"entry", "mid", "senior"}:
        update["experience_level"] = body.experience_level

    if not update:
        return {"ok": True, "applicant": applicant}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.applicants.update_one({"applicant_id": applicant["applicant_id"]}, {"$set": update})
    applicant = await db.applicants.find_one({"applicant_id": applicant["applicant_id"]}, {"_id": 0})
    return {"ok": True, "applicant": applicant}


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
async def compare_applicants(body: CompareIn, request: Request):
    if not body.ids or len(body.ids) > 4:
        raise HTTPException(status_code=400, detail="Compare 1–4 applicants")
    db = get_db()
    # top_companies reveals where an applicant applied — PII. Only authenticated
    # viewers get it; anonymous callers get the public stats with it empty.
    viewer = await get_optional_user(request)
    items = []
    for aid in body.ids:
        a = await db.applicants.find_one({"applicant_id": aid}, {"_id": 0})
        if not a:
            continue
        apps_total = a.get("applications_count", 0)
        by_company = []
        if viewer is not None:
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
