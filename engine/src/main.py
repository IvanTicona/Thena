import logging
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine

from src.config import settings

logger = logging.getLogger(__name__)

_worker_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    logger.info(
        "Thena Engine starting | LLM: %s/%s", settings.LLM_PROVIDER, settings.LLM_MODEL
    )

    db_engine = create_engine(settings.DATABASE_URL)
    app.state.db_engine = db_engine

    # Start queue worker in background thread
    from src.infrastructure.queue.worker import ReviewWorker

    worker = ReviewWorker(db_engine)
    app.state.worker = worker

    global _worker_thread
    _worker_thread = threading.Thread(target=worker.start, daemon=True)
    _worker_thread.start()
    logger.info("Review worker started")

    yield

    # Shutdown
    worker.stop()
    db_engine.dispose()
    logger.info("Thena Engine shutting down")


app = FastAPI(
    title="Thena AI Engine",
    description="AI-powered thesis review engine",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_key(request: Request) -> None:
    """Dependency that validates X-Internal-Api-Key header.
    Skipped for /health endpoint.
    """
    # Skip validation if no key is configured (dev fallback)
    if not settings.INTERNAL_API_KEY:
        return

    api_key = request.headers.get("X-Internal-Api-Key", "")
    if api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: invalid API key")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "engine"}


@app.post("/knowledge/ingest", dependencies=[Depends(verify_api_key)])
async def ingest_knowledge(
    request: Request,
    file: UploadFile = File(...),
    layer: str = Form("INSTITUTIONAL"),
    source_document: str = Form(None),
    owner_id: str = Form(None),
) -> dict[str, str | int]:
    """Ingest a document into the knowledge base (chunk + embed + store)."""
    if file.content_type not in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        raise HTTPException(400, "Only PDF and DOCX files are supported")

    file_bytes = await file.read()
    source_name = source_document or file.filename
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""

    try:
        if ext == "pdf":
            from src.application.parsers.pdf_parser import parse_pdf

            parsed = parse_pdf(file_bytes)
            sections = parsed.sections
        elif ext == "docx":
            from src.application.parsers.docx_parser import parse_docx

            parsed = parse_docx(file_bytes)
            sections = [
                {
                    "heading": s.heading,
                    "level": s.level,
                    "content": s.content,
                    "offset_start": s.offset_start,
                    "offset_end": s.offset_end,
                }
                for s in parsed.sections
            ]
        else:
            raise HTTPException(400, f"Unsupported file extension: {ext}")

        from src.application.pipelines.chunker import chunk_text
        from src.application.pipelines.embedding import (
            embed_and_store,
            delete_by_source,
        )

        db_engine = request.app.state.db_engine

        # Replace existing chunks for this source
        delete_by_source(db_engine, source_name)

        chunks = chunk_text(parsed.full_text, sections=sections)
        embed_and_store(
            db_engine=db_engine,
            chunks=chunks,
            layer=layer,
            source_document=source_name,
            owner_id=owner_id,
        )

        return {
            "status": "ok",
            "source_document": source_name,
            "chunks_created": len(chunks),
            "layer": layer,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Knowledge ingestion failed: %s", str(e), exc_info=True)
        raise HTTPException(500, f"Ingestion failed: {str(e)}")


@app.delete("/knowledge/{source_document}", dependencies=[Depends(verify_api_key)])
async def delete_knowledge(request: Request, source_document: str) -> dict[str, str]:
    """Delete all chunks for a given source document."""
    from src.application.pipelines.embedding import delete_by_source

    db_engine = request.app.state.db_engine
    delete_by_source(db_engine, source_document)
    return {"status": "ok", "source_document": source_document}
