"""Public GitHub user fetch — unauthenticated, rate-limited (60 req/hr per IP)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

UA = {"User-Agent": "JobCity/1.0", "Accept": "application/vnd.github+json"}


async def fetch_public_commits_30d(username: str) -> tuple[int, str | None]:
    """Returns (commit_count_30d, error_message). Counts PushEvent commits from the
    public events feed (up to 90 most recent events)."""
    username = username.strip().lstrip("@")
    if not username:
        return 0, "Empty username"
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    total = 0
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=UA) as client:
            # First page only — public events return up to 90 most recent
            r = await client.get(f"https://api.github.com/users/{username}/events/public?per_page=100")
        if r.status_code == 404:
            return 0, "GitHub user not found"
        if r.status_code == 403:
            return 0, "GitHub API rate limit hit, try again later"
        r.raise_for_status()
        events = r.json()
        for ev in events:
            if ev.get("type") != "PushEvent":
                continue
            created = ev.get("created_at")
            if not created:
                continue
            try:
                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                continue
            if ts < cutoff:
                continue
            payload = ev.get("payload") or {}
            commits = payload.get("commits") or []
            total += len(commits)
        return total, None
    except Exception as e:  # noqa: BLE001
        logger.warning("github fetch failed for %s: %s", username, e)
        return 0, str(e)
