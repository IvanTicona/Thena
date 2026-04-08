"""
BullMQ Worker for Thena Engine.

Uses the official `bullmq` Python package (same Lua scripts as @nestjs/bullmq),
which is fully interoperable with the NestJS/BullMQ v5 producer on the server side.

The worker is async (asyncio-based). Synchronous LangGraph/DB work is offloaded
to a thread-pool executor so it never blocks the event loop.

Key design decisions:
- Queue name "review" matches the name registered in SubmissionModule (BullModule.registerQueue)
- BullMQ v5 uses sorted-set-based waiting lists (ZADD/ZPOPMIN) — the `bullmq` Python package
  handles all Redis key patterns and Lua scripts internally.
- uvicorn is started with --workers 1 (see Dockerfile) to guarantee only one worker
  instance runs per container. If multiple replicas are ever needed, spin up separate
  engine containers — BullMQ handles job distribution across multiple workers.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from bullmq import Worker, Job
from sqlalchemy.engine import Engine

from src.config import settings
from src.infrastructure.storage.minio_client import MinioStorage
from src.infrastructure.repositories.review_repository import ReviewRepository
from src.infrastructure.vector_store.retriever import RAGRetriever
from src.application.parsers.docx_parser import parse_docx
from src.application.workflows.review_graph import compile_review_graph
from src.application.escalation import check_escalation
from src.domain.entities import ReviewState

logger = logging.getLogger(__name__)

# Total timeout for a full review (all 6 agents run in parallel + synthesizer): 90 seconds.
# This is enforced around the entire graph.invoke() call.
REVIEW_TOTAL_TIMEOUT_SECONDS = 90


class ReviewWorker:
    """
    Wraps the bullmq.Worker and exposes start/stop lifecycle methods
    that integrate cleanly with FastAPI's asyncio event loop.
    """

    def __init__(self, db_engine: Engine) -> None:
        self._db_engine = db_engine
        self._storage = MinioStorage()
        self._repository = ReviewRepository(db_engine)
        self._retriever = RAGRetriever(db_engine)
        self._graph = compile_review_graph()
        # Thread executor for blocking synchronous work (LangGraph, DB, MinIO)
        self._executor = ThreadPoolExecutor(
            max_workers=2, thread_name_prefix="review-worker"
        )
        self._bullmq_worker: Worker | None = None

    # ── Public lifecycle ─────────────────────────────────────────────

    async def start(self) -> None:
        """Create the BullMQ Worker and start consuming jobs."""
        redis_opts = {"connection": settings.REDIS_URL}

        self._bullmq_worker = Worker(
            "review",  # Must match BullModule.registerQueue({ name: 'review' })
            self._process_job,  # Async processor — receives bullmq.Job
            redis_opts,
        )
        logger.info("BullMQ Worker started — consuming from queue 'review'")

    async def stop(self) -> None:
        """Gracefully drain the worker and close connections."""
        if self._bullmq_worker is not None:
            try:
                await self._bullmq_worker.close()
            except Exception as e:
                logger.warning("Error closing BullMQ worker: %s", e)
        self._executor.shutdown(wait=False)
        logger.info("BullMQ Worker stopped")

    # ── BullMQ processor ─────────────────────────────────────────────

    async def _process_job(self, job: Job, job_token: str) -> None:
        """
        Called by bullmq.Worker for every job dequeued from 'review'.

        job.data contains the payload added by the NestJS SubmissionService:
          { jobId, submissionId, chapterId, studentId, fileUrl, versionNumber }
        """
        job_id: str = job.data.get("jobId", "")
        submission_id: str = job.data.get("submissionId", "")
        chapter_id: str = job.data.get("chapterId", "")
        file_url: str = job.data.get("fileUrl", "")
        version_number: int = int(job.data.get("versionNumber", 1))

        logger.info(
            "Processing BullMQ job %s (db job_id=%s, submission=%s)",
            job.id,
            job_id,
            submission_id,
        )

        # Run the blocking review pipeline in a thread-pool with a hard timeout
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._run_review_sync,
                    job_id,
                    submission_id,
                    chapter_id,
                    file_url,
                    version_number,
                ),
                timeout=REVIEW_TOTAL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            timeout_msg = f"Review timed out after {REVIEW_TOTAL_TIMEOUT_SECONDS}s"
            logger.error("Review job %s timed out", job_id)
            try:
                self._repository.update_job_status(job_id, "FAILED", timeout_msg)
            except Exception as db_err:
                logger.error("Failed to mark timed-out job as FAILED: %s", db_err)
            # Re-raise so BullMQ marks the job as failed and applies retry/backoff
            raise RuntimeError(timeout_msg)

    # ── Synchronous review pipeline ──────────────────────────────────

    def _run_review_sync(
        self,
        job_id: str,
        submission_id: str,
        chapter_id: str,
        file_url: str,
        version_number: int = 1,
    ) -> None:
        """
        Synchronous review pipeline — runs in a thread-pool executor.

        Mirrors the original process_job() logic; kept sync because LangGraph,
        psycopg2, and MinIO are all blocking.
        """
        logger.info("Processing review job %s for submission %s", job_id, submission_id)

        try:
            # Update status to PROCESSING
            self._repository.update_job_status(job_id, "PROCESSING")

            # Get chapter info
            chapter_info = self._repository.get_chapter_info(chapter_id)

            # Download and parse DOCX
            file_bytes = self._storage.download_file(file_url)
            parsed = parse_docx(file_bytes)

            # Update submission with markdown
            self._repository.update_submission_markdown(submission_id, parsed.markdown)

            # Get previously approved chapters (context for coherence agent)
            previous_chapters = self._repository.get_approved_chapters(chapter_id)

            # Retrieve RAG context
            query = (
                f"Capitulo {chapter_info['chapter_number']}: "
                f"{chapter_info['chapter_title']}\n{parsed.full_text[:2000]}"
            )
            rag_context = self._retriever.retrieve(
                query, tutor_id=chapter_info.get("tutor_id")
            )

            # Retrieve BIBLIOGRAPHY-layer context for the citations agent
            bibliography_context = self._retriever.retrieve(
                query,
                tutor_id=chapter_info.get("tutor_id"),
                layers=["BIBLIOGRAPHY"],
            )

            # Build initial LangGraph state
            sections_dicts = [
                {
                    "heading": s.heading,
                    "level": s.level,
                    "content": s.content,
                    "offset_start": s.offset_start,
                    "offset_end": s.offset_end,
                }
                for s in parsed.sections
            ]

            initial_state: ReviewState = {
                "submission_id": submission_id,
                "chapter_number": chapter_info["chapter_number"],
                "chapter_title": chapter_info["chapter_title"],
                "document_text": parsed.full_text,
                "document_sections": sections_dicts,
                "markdown_content": parsed.markdown,
                "previous_chapters": previous_chapters,
                "rag_context": rag_context,
                "bibliography_context": bibliography_context,
                "tutor_id": chapter_info.get("tutor_id"),
                "structure_findings": [],
                "methodology_findings": [],
                "coherence_findings": [],
                "citations_findings": [],
                "format_findings": [],
                "integrity_findings": [],
                "observations": [],
                "summary": "",
                "agent_errors": {},
            }

            # Run the LangGraph workflow (blocking — runs 6 parallel agents + synthesizer)
            result = self._graph.invoke(initial_state)

            # Save results to the database
            self._repository.save_results(
                job_id=job_id,
                summary=result.get("summary", ""),
                observations=result.get("observations", []),
                agent_findings={
                    "structure_findings": result.get("structure_findings", []),
                    "methodology_findings": result.get("methodology_findings", []),
                    "coherence_findings": result.get("coherence_findings", []),
                    "citations_findings": result.get("citations_findings", []),
                    "format_findings": result.get("format_findings", []),
                    "integrity_findings": result.get("integrity_findings", []),
                },
            )

            # Check escalation — resilient, errors are swallowed inside check_escalation
            check_escalation(self._db_engine, chapter_id, version_number)

            # Mark job as completed
            self._repository.update_job_status(job_id, "COMPLETED")
            logger.info("Review job %s completed successfully", job_id)

        except Exception as e:
            logger.error("Review job %s failed: %s", job_id, str(e), exc_info=True)
            try:
                self._repository.update_job_status(job_id, "FAILED", str(e))
            except Exception as db_err:
                logger.error("Failed to mark job as FAILED in DB: %s", db_err)
            # Re-raise so BullMQ records the failure and can retry
            raise
