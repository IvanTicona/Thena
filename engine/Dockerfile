# =============================================================================
# Thena Engine — Multi-stage Dockerfile
# =============================================================================
# Development: docker compose up (uses target: development — uvicorn --reload)
# Production:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up
#              (uses target: production — no --reload, no file watching)
# =============================================================================
# IMPORTANT: --workers 1 is required in both modes.
# The ReviewWorker asyncio task is launched inside the FastAPI lifespan.
# Using --workers > 1 would spawn multiple uvicorn processes each running their
# own ReviewWorker instance, causing duplicate job processing from the BullMQ queue.
# For higher throughput, run multiple engine containers instead.
# =============================================================================

# ---- Shared base ----
FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# ---- Development (file watching enabled) ----
FROM base AS development
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--reload"]

# ---- Production (no file watching) ----
FROM base AS production
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
