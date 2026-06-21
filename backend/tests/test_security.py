"""Security-boundary tests for JobCity (P0/P1 from the review).

These are written TDD-style: they encode the *intended* secure behavior, so
they fail against the pre-fix code and pass once the fixes land.

Covered:
- Admin routes require admin auth (P0 — admin.py had zero auth).
- Regex/ReDoS injection: user `q` is treated as a literal, not a live regex (P1).
- Object-level authz: anonymous callers don't get applicant application history (P1).
- JWT boundary: forged / wrong-type tokens are rejected.
"""
import os

import pytest

from tests.conftest import auth_header


# ----------------------------------------------------------------------------
# P0 — Admin routes require admin authorization
# ----------------------------------------------------------------------------

@pytest.mark.parametrize("method,path", [
    ("post", "/api/admin/ingest"),
    ("get", "/api/admin/scheduler/status"),
    ("get", "/api/admin/stats"),
])
async def test_admin_requires_auth_anonymous(client, method, path):
    resp = await getattr(client, method)(path)
    assert resp.status_code in (401, 403), (
        f"{method.upper()} {path} must reject anonymous callers, got {resp.status_code}"
    )


async def test_admin_rejects_non_admin_user(client, make_user):
    user = await make_user(role="applicant")
    resp = await client.get("/api/admin/stats", headers=auth_header(user["token"]))
    assert resp.status_code == 403, "non-admin user must be forbidden from admin routes"


async def test_admin_allows_admin_role(client, make_user):
    admin = await make_user(email="admin@test.app", role="admin")
    resp = await client.get("/api/admin/stats", headers=auth_header(admin["token"]))
    assert resp.status_code == 200
    assert "users" in resp.json()


async def test_admin_allows_api_key_header(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-ops-key")
    resp = await client.get("/api/admin/stats", headers={"X-Admin-Key": "secret-ops-key"})
    assert resp.status_code == 200, "valid ADMIN_API_KEY must grant admin access for ops scripts"


async def test_admin_rejects_wrong_api_key(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-ops-key")
    resp = await client.get("/api/admin/stats", headers={"X-Admin-Key": "wrong"})
    assert resp.status_code in (401, 403)


# ----------------------------------------------------------------------------
# P1 — Regex / ReDoS injection: `q` is a literal, not a live regex
# ----------------------------------------------------------------------------

async def test_applicant_search_treats_q_as_literal(client, db):
    await db.applicants.insert_many([
        {"applicant_id": "a1", "display_name": "Alice", "headline": "Engineer",
         "skills": ["python"], "applications_count": 0, "building_seed": 1},
        {"applicant_id": "a2", "display_name": "Bob", "headline": "Designer",
         "skills": ["figma"], "applications_count": 0, "building_seed": 2},
    ])
    # ".*" is a regex that matches everything. Treated literally it matches nobody.
    resp = await client.get("/api/applicants", params={"q": ".*"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0, (
        "user query must be escaped: '.*' should match literally, not as a wildcard"
    )


async def test_applicant_search_literal_substring_still_works(client, db):
    await db.applicants.insert_one(
        {"applicant_id": "a1", "display_name": "Alice", "headline": "Python dev",
         "skills": ["python"], "applications_count": 0, "building_seed": 1}
    )
    resp = await client.get("/api/applicants", params={"q": "Ali"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1, "ordinary substring search must still match"


# ----------------------------------------------------------------------------
# P1 — Object-level authz: anonymous callers don't see application history (PII)
# ----------------------------------------------------------------------------

async def _seed_applicant_with_history(db):
    await db.applicants.insert_one(
        {"applicant_id": "app_x", "user_id": "user_x", "display_name": "Carol",
         "applications_count": 2, "building_seed": 3}
    )
    await db.applications.insert_many([
        {"applicant_id": "app_x", "job_id": "j1", "company_name": "Stripe",
         "applied_at": "2024-01-01T00:00:00Z"},
        {"applicant_id": "app_x", "job_id": "j2", "company_name": "Vercel",
         "applied_at": "2024-01-02T00:00:00Z"},
    ])


async def test_applicant_detail_public_profile_no_history_for_anonymous(client, db):
    await _seed_applicant_with_history(db)
    resp = await client.get("/api/applicants/app_x")
    assert resp.status_code == 200
    body = resp.json()
    # Public profile still browsable...
    assert body["applicant"]["display_name"] == "Carol"
    # ...but the application history (which companies, when) is PII — hidden.
    assert body["applications"] == [], "anonymous callers must not see application history"


async def test_applicant_detail_history_visible_to_authed_user(client, db, make_user):
    await _seed_applicant_with_history(db)
    user = await make_user()
    resp = await client.get("/api/applicants/app_x", headers=auth_header(user["token"]))
    assert resp.status_code == 200
    assert len(resp.json()["applications"]) == 2, "authed users may see application history"


async def test_compare_hides_top_companies_for_anonymous(client, db):
    await _seed_applicant_with_history(db)
    resp = await client.post("/api/applicants/compare", json={"ids": ["app_x"]})
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["stats"]["top_companies"] == [], (
        "anonymous compare must not leak which companies an applicant applied to"
    )


# ----------------------------------------------------------------------------
# JWT boundary
# ----------------------------------------------------------------------------

async def test_forged_jwt_rejected(client):
    resp = await client.get("/api/auth/me", headers=auth_header("not.a.real.token"))
    assert resp.status_code == 401


async def test_refresh_token_rejected_as_access(client, db, make_user):
    from auth_utils import create_refresh_token
    user = await make_user()
    refresh = create_refresh_token(user["user_id"])
    resp = await client.get("/api/auth/me", headers=auth_header(refresh))
    assert resp.status_code == 401, "a refresh token must not be accepted as an access token"
