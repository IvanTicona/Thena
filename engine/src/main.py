from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Thena Engine starting | LLM: {settings.LLM_PROVIDER}/{settings.LLM_MODEL}")
    yield
    # Shutdown
    print("Thena Engine shutting down")


app = FastAPI(
    title="Thena AI Engine",
    description="AI-powered thesis review engine",
    version="0.1.0",
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
