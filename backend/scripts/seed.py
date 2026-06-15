"""Idempotent seed: companies, jobs, demo applicants, admin + demo accounts."""
from __future__ import annotations

import hashlib
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from auth_utils import hash_password, new_user_id
from data.companies_seed import (
    COMPANIES_SEED,
    JOB_TITLES,
    JOB_DESCRIPTION_TEMPLATE,
    DEMO_APPLICANTS,
)
from data.us_cities import US_CITIES


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def _company_id(name: str) -> str:
    return f"co_{hashlib.md5(name.encode(), usedforsecurity=False).hexdigest()[:10]}"


def _job_id(company_name: str, title: str, city: str, idx: int) -> str:
    src = f"{company_name}|{title}|{city}|{idx}"
    return f"job_{hashlib.md5(src.encode(), usedforsecurity=False).hexdigest()[:14]}"


def _seed_int(s: str) -> int:
    return int(hashlib.md5(s.encode(), usedforsecurity=False).hexdigest()[:8], 16)


async def _seed_admin_and_demo(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@jobcity.test")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    demo_email = os.environ.get("DEMO_EMAIL", "demo@jobcity.test")
    demo_password = os.environ.get("DEMO_PASSWORD", "Demo123!")

    # admin
    admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if admin is None:
        await db.users.insert_one(
            {
                "user_id": new_user_id(),
                "email": admin_email,
                "name": "JobCity Admin",
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "provider": "password",
                "picture": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    # demo applicant
    demo = await db.users.find_one({"email": demo_email}, {"_id": 0})
    if demo is None:
        user_id = new_user_id()
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": demo_email,
                "name": "Demo Applicant",
                "password_hash": hash_password(demo_password),
                "role": "applicant",
                "provider": "password",
                "picture": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        applicant_id = f"app_{user_id.replace('user_', '')}"
        await db.applicants.insert_one(
            {
                "applicant_id": applicant_id,
                "user_id": user_id,
                "display_name": "Demo Applicant",
                "headline": "Demo user exploring JobCity",
                "bio": "I exist so the testing agent has something to click.",
                "experience_level": "mid",
                "skills": ["React", "FastAPI", "MongoDB"],
                "github_username": "demo",
                "github_commits_30d": 142,
                "location_city": "Seattle",
                "location_state": "WA",
                "avatar_url": "",
                "building_seed": _seed_int(user_id),
                "applications_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )


async def _seed_companies(db) -> int:
    n = 0
    for c in COMPANIES_SEED:
        slug = _slug(c["name"])
        company_id = _company_id(c["name"])
        doc = {
            "company_id": company_id,
            "name": c["name"],
            "slug": slug,
            "industry": c["industry"],
            "logo_url": c.get("logo_url", ""),
            "website": c.get("website", ""),
            "hq_city": c["hq_city"],
            "hq_state": c["hq_state"],
            "color_hex": c["color"],
        }
        await db.companies.replace_one({"slug": slug}, doc, upsert=True)
        n += 1
    return n


async def _seed_jobs(db) -> int:
    # Deterministic per-run randomness so re-runs don't snowball jobs
    rng = random.Random(42)
    # Wipe & re-create jobs for cleanliness (but keep ingested non-seed jobs)
    await db.jobs.delete_many({"source": "seed"})

    cities = list(US_CITIES.keys())
    n = 0
    for c in COMPANIES_SEED:
        company_id = _company_id(c["name"])
        # Each company posts in 3–6 random cities
        chosen_cities = rng.sample(cities, k=rng.randint(3, 6))
        for city_state in chosen_cities:
            city, state = city_state
            lat, lng = US_CITIES[city_state]
            count = rng.randint(2, 6)
            for i in range(count):
                title = rng.choice(JOB_TITLES)
                level_factor = 0.6 if title.startswith("Senior") else (0.8 if "Staff" in title else 1.0)
                base = rng.randint(90, 180) * 1000
                salary_min = int(base * level_factor)
                salary_max = int(salary_min * rng.uniform(1.15, 1.4))
                posted_at = datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 29))
                doc = {
                    "job_id": _job_id(c["name"], title, city, i),
                    "company_id": company_id,
                    "company_name": c["name"],
                    "company_color": c["color"],
                    "title": title,
                    "description": JOB_DESCRIPTION_TEMPLATE.format(title=title, city=city, state=state),
                    "city": city,
                    "state": state,
                    "lat": lat,
                    "lng": lng,
                    "remote": rng.random() < 0.25,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "source": "seed",
                    "source_url": "",
                    "posted_at": posted_at.isoformat(),
                    "is_active": True,
                }
                await db.jobs.replace_one({"job_id": doc["job_id"]}, doc, upsert=True)
                n += 1
    return n


async def _seed_demo_applicants(db) -> int:
    n = 0
    for (display_name, headline, level, city, state, skills, has_gh, commits) in DEMO_APPLICANTS:
        # deterministic user_id from name
        det = hashlib.md5(display_name.encode(), usedforsecurity=False).hexdigest()
        user_id = f"user_{det[:12]}"
        applicant_id = f"app_{det[:12]}"
        email = f"{_slug(display_name)}@demo.jobcity"
        await db.users.replace_one(
            {"email": email},
            {
                "user_id": user_id,
                "email": email,
                "name": display_name,
                "password_hash": None,
                "role": "applicant",
                "provider": "seed",
                "picture": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            upsert=True,
        )
        applicant_doc = {
            "applicant_id": applicant_id,
            "user_id": user_id,
            "display_name": display_name,
            "headline": headline,
            "bio": "",
            "experience_level": level,
            "skills": skills,
            "github_username": display_name.lower().split()[0] if has_gh else None,
            "github_commits_30d": commits,
            "location_city": city,
            "location_state": state,
            "avatar_url": "",
            "building_seed": _seed_int(user_id),
            "applications_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.applicants.replace_one({"applicant_id": applicant_id}, applicant_doc, upsert=True)
        n += 1
    return n


async def _seed_demo_applications(db) -> int:
    """Give each demo applicant 0–15 random applications so the city isn't empty."""
    rng = random.Random(7)
    applicants = await db.applicants.find({}, {"_id": 0}).to_list(length=500)
    jobs = await db.jobs.find({"is_active": True}, {"_id": 0}).limit(500).to_list(length=500)
    if not jobs:
        return 0
    n = 0
    # Wipe demo applications first
    await db.applications.delete_many({})
    counts: dict[str, int] = {}
    for a in applicants:
        # Demo account gets 5 applications, others 0-15
        if a.get("display_name") == "Demo Applicant":
            k = 5
        else:
            k = rng.randint(0, 15)
        if k == 0:
            counts[a["applicant_id"]] = 0
            continue
        chosen = rng.sample(jobs, min(k, len(jobs)))
        for job in chosen:
            await db.applications.insert_one(
                {
                    "applicant_id": a["applicant_id"],
                    "job_id": job["job_id"],
                    "job_title": job["title"],
                    "company_name": job["company_name"],
                    "company_id": job["company_id"],
                    "city": job["city"],
                    "state": job["state"],
                    "status": "submitted",
                    "cover_note": "",
                    "applied_at": (datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 25))).isoformat(),
                }
            )
            n += 1
        counts[a["applicant_id"]] = k
    # Update counts
    for aid, c in counts.items():
        await db.applicants.update_one({"applicant_id": aid}, {"$set": {"applications_count": c}})
    return n


async def run_seed(db, *, reset: bool = False) -> dict:
    if reset:
        for col in ("applications", "jobs", "applicants", "companies"):
            await db[col].delete_many({})
    await _seed_admin_and_demo(db)
    companies = await _seed_companies(db)
    jobs = await _seed_jobs(db)
    applicants = await _seed_demo_applicants(db)
    applications = await _seed_demo_applications(db)
    return {
        "companies": companies,
        "jobs": jobs,
        "applicants": applicants,
        "applications": applications,
    }


if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from db import init_db

    async def _main():
        db = init_db()
        res = await run_seed(db, reset=True)
        print("Seed complete:", res)

    asyncio.run(_main())
