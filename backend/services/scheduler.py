"""Background scheduler that refreshes job feeds every 6 hours."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_SECONDS = 6 * 60 * 60  # 6 hours

_task: asyncio.Task | None = None
_state: dict = {
    "running": False,
    "last_run_at": None,
    "last_counts": {},
    "last_error": None,
}


def state() -> dict:
    return dict(_state)


async def _run_once(db) -> dict:
    from services.ingestion import (
        ingest_remoteok,
        ingest_greenhouse,
        ingest_lever,
        ingest_yc,
    )

    counts: dict[str, int] = {}
    try:
        counts["remoteok"] = await ingest_remoteok(db)
    except Exception as e:  # noqa: BLE001
        logger.exception("remoteok ingestion failed")
        counts["remoteok"] = 0
    try:
        counts["greenhouse"] = await ingest_greenhouse(
            db, ["stripe", "airbnb", "vercel", "anthropic", "databricks", "openai", "discord"]
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("greenhouse ingestion failed")
        counts["greenhouse"] = 0
    try:
        counts["lever"] = await ingest_lever(db, ["palantir", "reddit", "lyft", "stickermule", "kong"])
    except Exception as e:  # noqa: BLE001
        logger.exception("lever ingestion failed")
        counts["lever"] = 0
    try:
        counts["yc"] = await ingest_yc(db, limit=80)
    except Exception as e:  # noqa: BLE001
        logger.exception("yc ingestion failed")
        counts["yc"] = 0
    return counts


async def _loop():
    from db import get_db

    # Stagger the first run a bit so startup isn't slow
    await asyncio.sleep(20)
    while True:
        db = get_db()
        _state["running"] = True
        try:
            counts = await _run_once(db)
            _state["last_counts"] = counts
            _state["last_error"] = None
            _state["last_run_at"] = datetime.now(timezone.utc).isoformat()
            logger.info("scheduler: ingest counts %s", counts)
        except Exception as e:  # noqa: BLE001
            _state["last_error"] = str(e)
            logger.exception("scheduler iteration failed")
        finally:
            _state["running"] = False
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)


def start():
    global _task
    if _task and not _task.done():
        return _task
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_loop())
    return _task


def stop():
    global _task
    if _task and not _task.done():
        _task.cancel()
    _task = None
