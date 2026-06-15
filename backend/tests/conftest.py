"""Hermetic test harness for the JobCity backend.

Runs the FastAPI app in-process against an in-memory mongomock-motor database
via httpx ASGITransport. No live server, no real Mongo, no network. Startup
events (scheduler/ingestion) are NOT triggered because we drive the app through
ASGITransport without a lifespan manager and seed the DB singleton directly.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# The backend uses absolute imports (`from db import ...`), so the backend
# directory must be importable as the top-level path.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Env must be set before importing the app modules.
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "jobcity_test")
os.environ.setdefault("CORS_ORIGINS", "*")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def db():
    """Fresh in-memory database per test, injected into the app singleton."""
    import db as db_module

    client = AsyncMongoMockClient()
    test_db = client["jobcity_test"]
    db_module._client = client
    db_module._db = test_db
    yield test_db
    db_module._client = None
    db_module._db = None


@pytest_asyncio.fixture
async def client(db):
    """httpx client bound to the FastAPI app (no lifespan/startup events)."""
    import server

    transport = ASGITransport(app=server.app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------- Auth helpers ----------------

@pytest_asyncio.fixture
async def make_user(db):
    """Factory: insert a user (+ token) with a given role."""
    from auth_utils import hash_password, create_access_token, new_user_id

    async def _make(email="user@test.app", password="Passw0rd!", role="applicant",
                    display_name="Test User"):
        user_id = new_user_id()
        doc = {
            "user_id": user_id,
            "email": email.lower(),
            "name": display_name,
            "password_hash": hash_password(password),
            "role": role,
            "provider": "password",
            "picture": "",
        }
        await db.users.insert_one(doc)
        token = create_access_token(user_id, email.lower())
        return {"user_id": user_id, "email": email.lower(), "token": token,
                "role": role, "password": password}

    return _make


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
