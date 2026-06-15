"""Auth routes: register, login, logout, me, refresh, Google session exchange."""
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from auth_utils import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    decode_token,
    new_user_id,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user,
)
from db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class RegisterIn(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    display_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: str = Field(min_length=3)
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


def _public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name") or u.get("display_name") or "",
        "role": u.get("role", "applicant"),
        "picture": u.get("picture", ""),
        "provider": u.get("provider", "password"),
    }


async def _ensure_applicant_profile(db, user_id: str, display_name: str, *, picture: str = "", location_city: str = "", location_state: str = ""):
    existing = await db.applicants.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return existing
    import hashlib

    # MongoDB stores 8-byte ints; truncate the md5 hash to 8 hex chars (32-bit) to stay safe.
    seed = int(hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()[:8], 16)
    applicant_id = f"app_{user_id.replace('user_', '')}"
    doc = {
        "applicant_id": applicant_id,
        "user_id": user_id,
        "display_name": display_name,
        "headline": "",
        "bio": "",
        "experience_level": "entry",
        "skills": [],
        "github_username": None,
        "github_commits_30d": 0,
        "location_city": location_city,
        "location_state": location_state,
        "avatar_url": picture,
        "building_seed": seed,
        "applications_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.applicants.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    db = get_db()
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = new_user_id()
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": body.display_name,
        "password_hash": hash_password(body.password),
        "role": "applicant",
        "provider": "password",
        "picture": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    await _ensure_applicant_profile(db, user_id, body.display_name)

    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"user": _public_user(user_doc), "token": access}


@router.post("/login")
async def login(body: LoginIn, response: Response):
    db = get_db()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(user["user_id"], email)
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)
    return {"user": _public_user(user), "token": access}


@router.post("/logout")
async def logout(response: Response, request: Request):
    # best-effort: also kill emergent session if present
    db = get_db()
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    # attach applicant_id for convenience
    db = get_db()
    applicant = await db.applicants.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": _public_user(user), "applicant": applicant}


@router.post("/refresh")
async def refresh_token_route(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    db = get_db()
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["user_id"], user["email"])
    new_refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, new_refresh)
    return {"ok": True}


@router.post("/google/session")
async def google_session(body: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for our auth cookies. Idempotent."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": body.session_id},
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Auth provider error: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")

    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture") or ""
    session_token = data.get("session_token") or ""

    db = get_db()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = new_user_id()
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": None,
            "role": "applicant",
            "provider": "google",
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name, "picture": picture}},
        )
        user["name"] = name
        user["picture"] = picture
    await _ensure_applicant_profile(db, user["user_id"], name, picture=picture)

    # Persist emergent session
    if session_token:
        await db.user_sessions.insert_one(
            {
                "user_id": user["user_id"],
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc),
            }
        )
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 3600,
        )

    # Also drop our own JWT for unified flow
    access = create_access_token(user["user_id"], email)
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)
    return {"user": _public_user(user), "token": access}
