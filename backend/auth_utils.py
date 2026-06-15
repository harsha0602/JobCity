"""Auth helpers: password hashing, JWT, and current-user resolution."""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MINUTES = 60 * 24 * 7  # 7 days for convenience
REFRESH_TOKEN_TTL_DAYS = 30


def _get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    # samesite=none + secure=True so cookies work cross-origin under https preview
    common = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_TTL_MINUTES * 60,
        **common,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        **common,
    )


def clear_auth_cookies(response) -> None:
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/")


def _extract_token(request: Request) -> Optional[str]:
    # 1) httpOnly cookie
    token = request.cookies.get("access_token")
    if token:
        return token
    # 2) Bearer header
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request) -> dict:
    from db import get_db

    token = _extract_token(request)
    if not token:
        # Optional: emergent google session_token cookie
        session_token = request.cookies.get("session_token")
        if session_token:
            db = get_db()
            sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
            if sess:
                expires_at = sess.get("expires_at")
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at and expires_at > datetime.now(timezone.utc):
                    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
                    if user:
                        return user
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    db = get_db()
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def require_admin(request: Request) -> dict:
    """Authorize admin-only routes.

    Grants access to either:
      1. A logged-in user whose ``role == "admin"``, or
      2. A request carrying ``X-Admin-Key`` matching the ``ADMIN_API_KEY`` env
         var (for deploy/seed scripts that have no interactive session).

    Fails closed: if no admin user exists and no key is configured/matched,
    every admin route is rejected.
    """
    admin_key = os.environ.get("ADMIN_API_KEY")
    provided_key = request.headers.get("X-Admin-Key")
    if admin_key and provided_key and secrets.compare_digest(provided_key, admin_key):
        return {"user_id": "__api_key__", "role": "admin", "via": "api_key"}

    user = await get_optional_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
