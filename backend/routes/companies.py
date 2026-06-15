"""Company routes."""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from db import get_db
from routes._search import literal_regex

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("")
async def list_companies(q: Optional[str] = None, limit: int = Query(100, le=200)):
    db = get_db()
    match: dict = {}
    if q:
        match["name"] = {"$regex": literal_regex(q), "$options": "i"}
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$sort": {"name": 1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "jobs",
                "let": {"cid": "$company_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$company_id", "$$cid"]},
                                    {"$eq": ["$is_active", True]},
                                ]
                            }
                        }
                    },
                    {"$count": "n"},
                ],
                "as": "_job_count",
            }
        },
        {
            "$addFields": {
                "jobs_count": {
                    "$ifNull": [{"$arrayElemAt": ["$_job_count.n", 0]}, 0]
                }
            }
        },
        {"$project": {"_id": 0, "_job_count": 0}},
    ]
    items = await db.companies.aggregate(pipeline).to_list(length=limit)
    return {"items": items}


@router.get("/{company_id}")
async def get_company(company_id: str):
    db = get_db()
    c = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    jobs = await db.jobs.find({"company_id": company_id, "is_active": True}, {"_id": 0}).sort("posted_at", -1).limit(100).to_list(length=100)
    return {"company": c, "jobs": jobs}
