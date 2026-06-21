"""FastAPI entrypoint for JobCity."""
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import logging  # noqa: E402
import os  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from db import init_db, setup_indexes  # noqa: E402
from routes.auth import router as auth_router  # noqa: E402
from routes.jobs import router as jobs_router  # noqa: E402
from routes.applications import router as applications_router  # noqa: E402
from routes.applicants import router as applicants_router  # noqa: E402
from routes.companies import router as companies_router  # noqa: E402
from routes.admin import router as admin_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("jobcity")

APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
_REQUIRED_ENV = ("JWT_SECRET", "MONGO_URL", "DB_NAME")


def _validate_config() -> None:
    """Fail closed: refuse to start with a missing/insecure config rather than
    crashing later on the first auth call or shipping a wide-open CORS policy."""
    missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    if APP_ENV == "production":
        if len(os.environ["JWT_SECRET"]) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
        if os.environ.get("CORS_ORIGINS", "*").strip() == "*":
            raise RuntimeError(
                "CORS_ORIGINS must be an explicit, comma-separated origin list in production (not '*')"
            )
    logger.info("config validated (APP_ENV=%s)", APP_ENV)


app = FastAPI(title="JobCity API")

# CORS: allow credentials from any origin (cookies require explicit origin under SameSite=None).
# We mirror the request origin so credentials work from the Emergent preview URL.
_origins_env = os.environ.get("CORS_ORIGINS", "*")
if _origins_env == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=[o.strip() for o in _origins_env.split(",") if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount routes
app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(applicants_router)
app.include_router(companies_router)
app.include_router(admin_router)


@app.get("/api/")
async def root():
    return {"app": "JobCity", "ok": True}


@app.on_event("startup")
async def _startup():
    _validate_config()
    init_db()
    await setup_indexes()
    # Start background ingestion scheduler (runs every 6h)
    try:
        from services.scheduler import start as start_scheduler
        start_scheduler()
        logger.info("background scheduler started")
    except Exception as e:  # noqa: BLE001
        logger.warning("scheduler failed to start: %s", e)
    logger.info("JobCity API ready")


@app.on_event("shutdown")
async def _shutdown():
    try:
        from services.scheduler import stop as stop_scheduler
        stop_scheduler()
    except Exception:  # noqa: BLE001
        pass
    from db import _client
    if _client:
        _client.close()
