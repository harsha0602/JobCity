"""Env-gated admin bootstrap.

This intentionally does NOT create fabricated jobs, companies, demo applicants,
or demo applications. Production must only ever serve real data:
  * Jobs come from real ATS APIs via `python -m ingest.cli run`.
  * Applicants are real registered users.

The only thing bootstrapped here is a single admin account, and only when
strong, non-default ADMIN_EMAIL/ADMIN_PASSWORD are provided.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from auth_utils import hash_password, new_user_id

# Credentials we refuse to deploy with — they shipped as dev defaults.
_DEFAULT_ADMIN_EMAILS = {"admin@jobcity.test"}
_DEFAULT_ADMIN_PASSWORDS = {"Admin123!"}


async def bootstrap_admin(db) -> dict:
    """Create one admin user if ADMIN_EMAIL/ADMIN_PASSWORD are set, non-default,
    and no admin exists yet. Idempotent and safe to run on every deploy."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""

    if not email or not password:
        return {"admin_created": False, "reason": "ADMIN_EMAIL/ADMIN_PASSWORD not set"}
    if email in _DEFAULT_ADMIN_EMAILS or password in _DEFAULT_ADMIN_PASSWORDS:
        raise RuntimeError(
            "Refusing to bootstrap admin with default credentials. "
            "Set a strong, unique ADMIN_EMAIL and ADMIN_PASSWORD."
        )

    existing = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if existing is not None:
        return {"admin_created": False, "reason": "an admin already exists"}

    await db.users.insert_one(
        {
            "user_id": new_user_id(),
            "email": email,
            "name": "JobCity Admin",
            "password_hash": hash_password(password),
            "role": "admin",
            "provider": "password",
            "picture": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"admin_created": True, "email": email}


if __name__ == "__main__":
    import asyncio
    from pathlib import Path

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from db import init_db

    async def _main():
        db = init_db()
        res = await bootstrap_admin(db)
        print("Admin bootstrap:", res)

    asyncio.run(_main())
