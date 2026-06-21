# JobCity backend — FastAPI on uvicorn.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8001

WORKDIR /app

# curl is used by the container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. AI deps live in requirements-ai.txt and
# are intentionally NOT installed here (AI_FEATURES_ENABLED defaults off).
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as a non-root user.
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

# Liveness: the root API route returns 200 without touching the DB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/" || exit 1

# Single worker: the app is async and the in-process scheduler must not run in
# multiple processes (it is also disabled via env in prod; ingest runs as a
# scheduled GitHub Action). Honors $PORT so the same image works on Render.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
