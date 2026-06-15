"""JobCity backend API tests.

Covers:
- Health (/api/)
- Jobs-City buildings
- Applicants-City buildings
- Jobs listing
- Companies listing
- Auth (login/register/me)
- Applications (create/duplicate/mine)
- Applicants detail and compare
- Admin seed idempotency
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hiring-map.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@jobcity.app"
DEMO_PASSWORD = "Demo123!"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"]


@pytest.fixture
def demo_auth(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


# ---------------- Health ----------------

class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "JobCity"
        assert data.get("ok") is True


# ---------------- Jobs City ----------------

class TestJobsCity:
    def test_buildings(self, session):
        r = session.get(f"{API}/jobs-city/buildings")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data
        cities = data["cities"]
        assert isinstance(cities, list) and len(cities) > 0
        c0 = cities[0]
        for k in ("city", "state", "lat", "lng", "total_jobs", "companies"):
            assert k in c0, f"missing key {k} in city: {c0}"
        assert isinstance(c0["companies"], list) and len(c0["companies"]) > 0
        comp = c0["companies"][0]
        for k in ("id", "name", "color", "floors"):
            assert k in comp, f"missing key {k} in company: {comp}"


# ---------------- Applicants City ----------------

class TestApplicantsCity:
    def test_buildings(self, session):
        r = session.get(f"{API}/applicants-city/buildings")
        assert r.status_code == 200
        data = r.json()
        # endpoint may return list directly or {applicants: [...]}
        applicants = data if isinstance(data, list) else data.get("applicants", [])
        assert isinstance(applicants, list) and len(applicants) > 0
        a0 = applicants[0]
        for k in ("id", "display_name", "floors", "grid_x", "grid_z", "experience_level"):
            assert k in a0, f"missing key {k} in applicant: {a0}"


# ---------------- Jobs ----------------

class TestJobs:
    def test_jobs_paginated(self, session):
        r = session.get(f"{API}/jobs", params={"limit": 5})
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("jobs", []))
        assert isinstance(items, list)
        assert 0 < len(items) <= 5


# ---------------- Companies ----------------

class TestCompanies:
    def test_companies_have_jobs_count(self, session):
        r = session.get(f"{API}/companies")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("companies", data.get("items", []))
        assert len(items) >= 20, f"expected >=20 companies, got {len(items)}"
        for c in items[:5]:
            assert "jobs_count" in c, f"company missing jobs_count: {c}"


# ---------------- Auth ----------------

class TestAuth:
    def test_login_demo_sets_cookies(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "token" in data
        assert data["user"]["email"] == DEMO_EMAIL
        # Set-Cookie inspection
        set_cookie = r.headers.get("set-cookie", "")
        assert "access_token" in set_cookie, f"access_token cookie missing: {set_cookie}"
        assert "refresh_token" in set_cookie, f"refresh_token cookie missing: {set_cookie}"

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_register_creates_user_and_applicant(self, session):
        ts = int(time.time() * 1000)
        email = f"test+{ts}@jobcity.app"
        password = "TestPass123"
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": password, "display_name": "Tester"
        })
        assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
        data = r.json()
        # token may or may not be returned
        token = data.get("token")
        if not token:
            # login to get token
            lr = session.post(f"{API}/auth/login", json={"email": email, "password": password})
            assert lr.status_code == 200
            token = lr.json()["token"]
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        body = me.json()
        assert body.get("user", {}).get("email") == email or body.get("email") == email
        # applicant profile should exist
        applicant = body.get("applicant")
        assert applicant is not None, f"applicant profile missing in /auth/me: {body}"

    def test_me_with_bearer(self, session, demo_auth):
        r = session.get(f"{API}/auth/me", headers=demo_auth)
        assert r.status_code == 200
        body = r.json()
        user = body.get("user", body)
        assert user.get("email") == DEMO_EMAIL

    def test_me_without_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- Applications ----------------

class TestApplications:
    def test_mine_has_seed_apps(self, session, demo_auth):
        r = session.get(f"{API}/applications/mine", headers=demo_auth)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("applications", []))
        assert len(items) >= 5, f"expected >=5 demo applications, got {len(items)}"

    def test_create_and_duplicate(self, session, demo_auth):
        # Get a job id that's not already applied to
        mine = session.get(f"{API}/applications/mine", headers=demo_auth).json()
        mine_items = mine if isinstance(mine, list) else mine.get("items", mine.get("applications", []))
        applied_job_ids = {a.get("job_id") for a in mine_items}

        jr = session.get(f"{API}/jobs", params={"limit": 200})
        jobs = jr.json()
        jobs_items = jobs if isinstance(jobs, list) else jobs.get("items", jobs.get("jobs", []))
        candidate = None
        for j in jobs_items:
            jid = j.get("job_id") or j.get("id") or j.get("_id")
            if jid and jid not in applied_job_ids:
                candidate = jid
                break
        assert candidate, "no candidate job to apply"

        r1 = session.post(f"{API}/applications", json={"job_id": candidate}, headers=demo_auth)
        assert r1.status_code in (200, 201), f"first apply failed: {r1.status_code} {r1.text}"

        r2 = session.post(f"{API}/applications", json={"job_id": candidate}, headers=demo_auth)
        assert r2.status_code == 400, f"expected 400 duplicate, got {r2.status_code} {r2.text}"


# ---------------- Applicants ----------------

class TestApplicantsDetail:
    def test_detail_and_compare(self, session):
        r = session.get(f"{API}/applicants-city/buildings")
        assert r.status_code == 200
        data = r.json()
        applicants = data if isinstance(data, list) else data.get("applicants", [])
        assert len(applicants) >= 2
        a1, a2 = applicants[0]["id"], applicants[1]["id"]

        d = session.get(f"{API}/applicants/{a1}")
        assert d.status_code == 200, f"applicant detail failed: {d.status_code} {d.text}"
        det = d.json()
        # should contain applicant info + recent applications
        assert "applicant" in det or "id" in det
        # recent applications expected somewhere
        assert "applications" in det or "recent_applications" in det or "recent" in det, \
            f"recent applications missing in detail: {list(det.keys())}"

        cmp = session.post(f"{API}/applicants/compare", json={"ids": [a1, a2]})
        assert cmp.status_code == 200, f"compare failed: {cmp.status_code} {cmp.text}"
        cdata = cmp.json()
        items = cdata if isinstance(cdata, list) else cdata.get("items", cdata.get("results", []))
        assert len(items) == 2
        for it in items:
            stats = it.get("stats", it)
            assert "applications_count" in stats
            assert "github_commits_30d" in stats
            assert "top_companies" in stats


# ---------------- Admin ----------------

class TestAdmin:
    def test_seed_idempotent(self, session):
        r1 = session.post(f"{API}/admin/seed")
        assert r1.status_code == 200, f"seed failed: {r1.status_code} {r1.text}"
        r2 = session.post(f"{API}/admin/seed")
        assert r2.status_code == 200
        assert isinstance(r2.json(), dict)


# ---------------- AI Job Brief (iteration 4) ----------------

class TestJobBrief:
    """Iteration-4 AI role brief endpoint (no auth required, 7d cache)."""

    def _pick_job_id(self, session):
        r = session.get(f"{API}/jobs", params={"limit": 5})
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert items, "no jobs returned"
        return items[0].get("job_id") or items[0].get("id")

    def test_brief_no_auth(self, session):
        job_id = self._pick_job_id(session)
        # explicit fresh request without auth
        r = requests.get(f"{API}/jobs/{job_id}/summary", timeout=25)
        assert r.status_code == 200, f"expected 200 without auth, got {r.status_code} {r.text}"
        body = r.json()
        assert "brief" in body and "cached" in body
        brief = body["brief"]
        assert isinstance(brief.get("summary"), str) and len(brief["summary"]) > 0
        assert isinstance(brief.get("required_skills"), list)
        assert isinstance(brief.get("nice_to_have"), list)
        assert isinstance(brief.get("seniority"), str) and len(brief["seniority"]) > 0

    def test_brief_cached_on_second_call(self, session):
        job_id = self._pick_job_id(session)
        r1 = requests.get(f"{API}/jobs/{job_id}/summary", timeout=25)
        assert r1.status_code == 200
        b1 = r1.json()
        # second call should be (almost) instant and cached=True
        t0 = time.time()
        r2 = requests.get(f"{API}/jobs/{job_id}/summary", timeout=10)
        dt = time.time() - t0
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2.get("cached") is True, f"expected cached:true on 2nd call, got: {b2}"
        assert b2["brief"]["summary"] == b1["brief"]["summary"]
        assert dt < 5.0, f"cached call too slow: {dt:.2f}s"

    def test_brief_404_for_missing_job(self, session):
        r = requests.get(f"{API}/jobs/job_doesnotexist/summary", timeout=10)
        assert r.status_code == 404
