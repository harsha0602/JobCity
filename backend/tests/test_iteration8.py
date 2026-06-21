"""Iteration-8 regression: invalid `?category=` must fall back to TECHNICAL_IC default,
not silently bypass the filter and leak manager/sales/PM rows.

RCA target: routes/jobs.py `_build_category_filter()` is the single source of truth
shared by GET /api/jobs and GET /api/jobs-city/buildings.
"""
import os
import requests
import pytest


def _load_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    # Fall back to frontend/.env so this file can run outside the conftest harness.
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
JOBS = f"{BASE_URL}/api/jobs"
BUILDINGS = f"{BASE_URL}/api/jobs-city/buildings"

TECHNICAL_IC = {"software", "robotics", "ml", "data", "security", "infra", "hardware"}

# Iteration-7 baselines (per problem statement)
TOTAL_ALL = 3971         # category=all bypass
TOTAL_IC_DEFAULT = 1336  # TECHNICAL_IC default
TOTAL_ROBOTICS = 22
CITIES_ALL = 28
CITIES_IC = 12


def _get_total(url, params=None):
    r = requests.get(url, params=params, timeout=30)
    assert r.status_code == 200, f"{url} {params} -> {r.status_code}: {r.text[:300]}"
    body = r.json()
    # /api/jobs returns {"total": N, "items": [...]}
    if isinstance(body, dict) and "total" in body:
        return body["total"], body
    return None, body


# ---------- /api/jobs ----------

class TestJobsCategoryFilter:
    def test_invalid_garbage_falls_back_to_ic_default(self):
        total, body = _get_total(JOBS, {"category": "invalid_garbage", "limit": 200})
        assert total == TOTAL_IC_DEFAULT, f"expected {TOTAL_IC_DEFAULT}, got {total}"
        # Every returned item.category must be in TECHNICAL_IC
        bad = [it.get("category") for it in body["items"] if it.get("category") not in TECHNICAL_IC]
        assert not bad, f"non-IC categories leaked: {set(bad)}"

    def test_all_invalid_csv_falls_back_to_ic_default(self):
        total, body = _get_total(JOBS, {"category": "garbage1,garbage2", "limit": 200})
        assert total == TOTAL_IC_DEFAULT
        bad = [it.get("category") for it in body["items"] if it.get("category") not in TECHNICAL_IC]
        assert not bad, f"non-IC categories leaked: {set(bad)}"

    def test_partial_valid_csv_keeps_only_valid(self):
        # software,garbage -> only software
        total, body = _get_total(JOBS, {"category": "software,garbage", "limit": 200})
        assert total > 0
        cats = {it.get("category") for it in body["items"]}
        assert cats == {"software"}, f"expected only software, got {cats}"

    def test_all_still_bypasses_filter(self):
        total, _ = _get_total(JOBS, {"category": "all"})
        assert total == TOTAL_ALL, f"expected {TOTAL_ALL}, got {total}"

    def test_no_param_defaults_to_ic(self):
        total, _ = _get_total(JOBS, None)
        assert total == TOTAL_IC_DEFAULT, f"expected {TOTAL_IC_DEFAULT}, got {total}"

    def test_robotics_regression(self):
        total, body = _get_total(JOBS, {"category": "robotics"})
        assert total == TOTAL_ROBOTICS, f"expected {TOTAL_ROBOTICS}, got {total}"
        cats = {it.get("category") for it in body["items"]}
        assert cats == {"robotics"}


# ---------- /api/jobs-city/buildings ----------

def _buildings_totals(params=None):
    r = requests.get(BUILDINGS, params=params, timeout=30)
    assert r.status_code == 200, f"{BUILDINGS} {params} -> {r.status_code}: {r.text[:300]}"
    data = r.json()
    cities = data.get("cities", []) if isinstance(data, dict) else data
    total_floors = sum(c.get("total_jobs", 0) for c in cities)
    return len(cities), total_floors, data


class TestBuildingsCategoryFilter:
    def test_invalid_falls_back_to_ic(self):
        n_cities, n_floors, _ = _buildings_totals({"category": "invalid_garbage"})
        assert n_cities == CITIES_IC, f"cities expected {CITIES_IC} got {n_cities}"
        assert n_floors == TOTAL_IC_DEFAULT, f"floors expected {TOTAL_IC_DEFAULT} got {n_floors}"

    def test_all_bypasses(self):
        n_cities, n_floors, _ = _buildings_totals({"category": "all"})
        assert n_cities == CITIES_ALL, f"cities expected {CITIES_ALL} got {n_cities}"
        assert n_floors == TOTAL_ALL, f"floors expected {TOTAL_ALL} got {n_floors}"

    def test_no_param_defaults_ic(self):
        n_cities, n_floors, _ = _buildings_totals(None)
        assert n_cities == CITIES_IC
        assert n_floors == TOTAL_IC_DEFAULT


# ---------- Regressions ----------

class TestRegressions:
    def test_filters_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/jobs/filters", timeout=15)
        assert r.status_code == 200
        body = r.json()
        for k in ("levels", "sources", "cities", "categories", "tech"):
            assert k in body, f"missing key {k} in /jobs/filters response"
            assert body[k], f"{k} is empty"

    def test_demo_login(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@jobcity.test", "password": "Demo123!"},
            timeout=15,
        )
        assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        # Accept common token shapes
        assert any(k in body for k in ("access_token", "token", "jwt")), f"no token in {body.keys()}"
