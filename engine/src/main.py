import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text

from src.config import settings

logger = logging.getLogger(__name__)

# ── Worker crash-recovery constants (P2-11) ─────────────────────────────────
_MAX_RESTART_ATTEMPTS = 5
_RESTART_BASE_DELAY_SECONDS = 2.0  # exponential back-off base


async def _run_worker_with_recovery(db_engine) -> None:
    """
    Supervisor loop: starts the BullMQ ReviewWorker and restarts it if it crashes.
    Uses exponential back-off (2s, 4s, 8s, 16s, 32s) then gives up.
    This coroutine is launched as a background asyncio task so it does not
    block the FastAPI event loop.
    """
    from src.infrastructure.queue.worker import ReviewWorker

    attempt = 0
    while attempt <= _MAX_RESTART_ATTEMPTS:
        worker = ReviewWorker(db_engine)
        try:
            await worker.start()
            logger.info(
                "ReviewWorker running (attempt %d/%d)",
                attempt + 1,
                _MAX_RESTART_ATTEMPTS + 1,
            )
            # bullmq.Worker runs continuously in the background via its own internal
            # asyncio tasks.  We park here — this coroutine will be cancelled on shutdown.
            await asyncio.get_running_loop().create_future()  # park indefinitely

        except asyncio.CancelledError:
            # Graceful shutdown requested — stop the worker and exit the loop
            logger.info("ReviewWorker supervisor received shutdown signal")
            await worker.stop()
            return

        except Exception as e:
            await worker.stop()
            attempt += 1
            if attempt > _MAX_RESTART_ATTEMPTS:
                logger.error(
                    "ReviewWorker failed %d times — giving up. Last error: %s",
                    _MAX_RESTART_ATTEMPTS,
                    str(e),
                    exc_info=True,
                )
                return

            delay = _RESTART_BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            logger.error(
                "ReviewWorker crashed (attempt %d/%d), restarting in %.1fs. Error: %s",
                attempt,
                _MAX_RESTART_ATTEMPTS,
                delay,
                str(e),
                exc_info=True,
            )
            await asyncio.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info(
        "Thena Engine starting | LLM: %s/%s", settings.LLM_PROVIDER, settings.LLM_MODEL
    )

    db_engine = create_engine(settings.DATABASE_URL)
    app.state.db_engine = db_engine

    # Launch the worker supervisor as a background asyncio task.
    # Using a single asyncio task (not a thread) means there is EXACTLY ONE
    # worker instance per uvicorn process.  The Dockerfile uses --workers 1
    # to ensure only one uvicorn process runs, preventing duplicate workers.
    worker_task = asyncio.create_task(
        _run_worker_with_recovery(db_engine),
        name="review-worker-supervisor",
    )
    app.state.worker_task = worker_task
    logger.info("Review worker supervisor started")

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("Thena Engine shutting down — cancelling worker task")
    worker_task.cancel()
    try:
        await asyncio.wait_for(asyncio.shield(worker_task), timeout=10)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass

    db_engine.dispose()
    logger.info("Thena Engine shut down cleanly")


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
async def health_check(request: Request) -> dict:
    db_status = "ok"
    try:
        db_engine = request.app.state.db_engine
        with db_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Health check: DB probe failed")
        db_status = "error"

    if db_status != "ok":
        return JSONResponse(
            status_code=503,
            content={"status": "error", "services": {"db": db_status}},
        )

    return {"status": "ok", "services": {"db": db_status}}


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
