FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# IMPORTANT: --workers 1 is required.
# The ReviewWorker asyncio task is launched inside the FastAPI lifespan.
# Using --workers > 1 would spawn multiple uvicorn processes each running their
# own ReviewWorker instance, causing duplicate job processing from the BullMQ queue.
# For higher throughput, run multiple engine containers instead (BullMQ distributes
# across consumers correctly at the container level).
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--reload"]
