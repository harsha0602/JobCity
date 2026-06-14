"""JobCity backend iteration-2 tests.

New features covered:
- POST /api/admin/ingest/lever
- POST /api/admin/ingest/yc
- GET  /api/admin/scheduler/status
- POST /api/applicants/me/github (auth required, success + warning path)
- POST /api/applicants/me/github/sync
- POST /api/jobs/{job_id}/match-score (auth required, cache, 404)
- GET  /api/jobs-city/buildings perf
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@jobcity.app"
DEMO_PASSWORD = "Demo123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"demo login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture
def demo_auth(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


# ---------------- Admin ingestion (Lever + YC) ----------------

class TestIngestion:
    def test_ingest_lever(self, session):
        r = session.post(f"{API}/admin/ingest/lever", timeout=120)
        assert r.status_code == 200, f"lever ingest failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("ingested"), int)
        assert data["ingested"] > 0, f"expected lever ingested > 0, got {data}"

    def test_ingest_yc(self, session):
        r = session.post(f"{API}/admin/ingest/yc", timeout=120)
        assert r.status_code == 200, f"yc ingest failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("ingested"), int)
        assert data["ingested"] > 0, f"expected yc ingested > 0, got {data}"


# ---------------- Scheduler status ----------------

class TestScheduler:
    def test_scheduler_status_shape(self, session):
        r = session.get(f"{API}/admin/scheduler/status")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        for k in ("running", "last_run_at", "last_counts", "last_error"):
            assert k in data, f"missing scheduler key {k} in {data}"


# ---------------- GitHub linking ----------------

class TestGitHubLink:
    def test_link_unauth(self, session):
        r = session.post(f"{API}/applicants/me/github", json={"github_username": "torvalds"})
        assert r.status_code == 401

    def test_link_torvalds(self, session, demo_auth):
        r = session.post(
            f"{API}/applicants/me/github",
            json={"github_username": "torvalds"},
            headers=demo_auth,
            timeout=30,
        )
        assert r.status_code == 200, f"link failed: {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("github_username") == "torvalds"
        assert isinstance(data.get("github_commits_30d"), int)
        assert data["github_commits_30d"] >= 0

        # Verify /auth/me reflects the change
        me = session.get(f"{API}/auth/me", headers=demo_auth)
        assert me.status_code == 200
        body = me.json()
        applicant = body.get("applicant") or {}
        assert applicant.get("github_username") == "torvalds"
        assert int(applicant.get("github_commits_30d", -1)) >= 0

    def test_link_nonexistent_user(self, session, demo_auth):
        r = session.post(
            f"{API}/applicants/me/github",
            json={"github_username": "this-user-definitely-does-not-exist-987654321zzz"},
            headers=demo_auth,
            timeout=30,
        )
        assert r.status_code == 200, f"unexpected status: {r.text}"
        data = r.json()
        assert data.get("ok") is True
        # Rate limit may also surface here — both are acceptable
        warning = data.get("warning")
        assert warning, f"expected non-empty warning, got {data}"
        assert int(data.get("github_commits_30d", -1)) == 0

    def test_sync_after_link(self, session, demo_auth):
        # ensure linked first
        session.post(
            f"{API}/applicants/me/github",
            json={"github_username": "torvalds"},
            headers=demo_auth,
            timeout=30,
        )
        r = session.post(f"{API}/applicants/me/github/sync", headers=demo_auth, timeout=30)
        assert r.status_code == 200, f"sync failed: {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("github_commits_30d"), int)
        assert data["github_commits_30d"] >= 0


# ---------------- Match score ----------------

class TestMatchScore:
    def _pick_job_id(self, session):
        r = session.get(f"{API}/jobs", params={"limit": 1})
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert items, "no jobs available"
        return items[0].get("job_id") or items[0].get("id")

    def test_unauth(self, session):
        jid = self._pick_job_id(session)
        # use a fresh session so we don't reuse the demo cookies
        r = requests.post(f"{API}/jobs/{jid}/match-score")
        assert r.status_code == 401

    def test_404_for_missing_job(self, session, demo_auth):
        r = session.post(f"{API}/jobs/job_doesnotexist/match-score", headers=demo_auth, timeout=60)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_score_and_cache(self, session, demo_auth):
        jid = self._pick_job_id(session)

        # First call — may hit LLM (up to ~30s)
        t0 = time.time()
        r1 = session.post(f"{API}/jobs/{jid}/match-score", headers=demo_auth, timeout=60)
        elapsed = time.time() - t0
        assert r1.status_code == 200, f"match-score failed: {r1.status_code} {r1.text}"
        d1 = r1.json()
        assert "match" in d1
        m1 = d1["match"]
        assert isinstance(m1.get("score"), int) and 0 <= m1["score"] <= 100
        assert isinstance(m1.get("rationale"), str) and len(m1["rationale"]) > 0
        assert isinstance(m1.get("strengths"), list)
        assert isinstance(m1.get("gaps"), list)
        print(f"\nfirst match-score took {elapsed:.2f}s, cached={d1.get('cached')}")

        # Second call — should be cached
        r2 = session.post(f"{API}/jobs/{jid}/match-score", headers=demo_auth, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("cached") is True, f"expected cached=true, got {d2}"
        assert d2["match"]["score"] == m1["score"], "cached score differs from first call"


# ---------------- Jobs-city perf ----------------

class TestJobsCityPerf:
    def test_buildings_under_5s(self, session):
        t0 = time.time()
        r = session.get(f"{API}/jobs-city/buildings", timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 5, f"jobs-city/buildings took {elapsed:.2f}s"
        data = r.json()
        assert "cities" in data and isinstance(data["cities"], list)
