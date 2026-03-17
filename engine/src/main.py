import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine

from src.config import settings

_worker_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Thena Engine starting | LLM: {settings.LLM_PROVIDER}/{settings.LLM_MODEL}")

    db_engine = create_engine(settings.DATABASE_URL)
    app.state.db_engine = db_engine

    # Start queue worker in background thread
    from src.infrastructure.queue.worker import ReviewWorker

    worker = ReviewWorker(db_engine)
    app.state.worker = worker

    global _worker_thread
    _worker_thread = threading.Thread(target=worker.start, daemon=True)
    _worker_thread.start()
    print("Review worker started")

    yield

    # Shutdown
    worker.stop()
    db_engine.dispose()
    print("Thena Engine shutting down")


app = FastAPI(
    title="Thena AI Engine",
    description="AI-powered thesis review engine",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "engine"}
