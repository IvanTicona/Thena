import asyncio
import json
import logging
import time

import redis

from src.config import settings
from src.infrastructure.storage.minio_client import MinioStorage
from src.infrastructure.repositories.review_repository import ReviewRepository
from src.infrastructure.vector_store.retriever import RAGRetriever
from src.application.parsers.docx_parser import parse_docx
from src.application.workflows.review_graph import compile_review_graph
from src.domain.entities import ReviewState

logger = logging.getLogger(__name__)

QUEUE_NAME = "bull:review:process-review"
POLL_INTERVAL = 2  # seconds


class ReviewWorker:
    def __init__(self, db_engine):
        self._db_engine = db_engine
        self._storage = MinioStorage()
        self._repository = ReviewRepository(db_engine)
        self._retriever = RAGRetriever(db_engine)
        self._graph = compile_review_graph()
        self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self._running = False

    def process_job(self, job_data: dict):
        """Process a single review job."""
        job_id = job_data["jobId"]
        submission_id = job_data["submissionId"]
        chapter_id = job_data["chapterId"]
        file_url = job_data["fileUrl"]

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

            # Get previously approved chapters
            previous_chapters = self._repository.get_approved_chapters(chapter_id)

            # Retrieve RAG context
            query = f"Capitulo {chapter_info['chapter_number']}: {chapter_info['chapter_title']}\n{parsed.full_text[:2000]}"
            rag_context = self._retriever.retrieve(
                query, tutor_id=chapter_info.get("tutor_id")
            )

            # Build initial state
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
                "tutor_id": chapter_info.get("tutor_id"),
                "structure_findings": [],
                "methodology_findings": [],
                "coherence_findings": [],
                "observations": [],
                "summary": "",
                "agent_errors": {},
            }

            # Run the LangGraph workflow
            result = self._graph.invoke(initial_state)

            # Save results
            self._repository.save_results(
                job_id=job_id,
                summary=result.get("summary", ""),
                observations=result.get("observations", []),
                agent_findings={
                    "structure_findings": result.get("structure_findings", []),
                    "methodology_findings": result.get("methodology_findings", []),
                    "coherence_findings": result.get("coherence_findings", []),
                },
            )

            # Mark job as completed
            self._repository.update_job_status(job_id, "COMPLETED")
            logger.info("Review job %s completed successfully", job_id)

        except Exception as e:
            logger.error("Review job %s failed: %s", job_id, str(e), exc_info=True)
            self._repository.update_job_status(job_id, "FAILED", str(e))

    def poll_queue(self):
        """Poll Redis for BullMQ jobs. Simplified polling for MVP."""
        # BullMQ stores jobs in Redis lists/sorted sets
        # For MVP, we poll the "wait" list
        try:
            # Try to get a job from the BullMQ wait list
            result = self._redis.brpoplpush(
                f"bull:review:wait", f"bull:review:active", timeout=POLL_INTERVAL
            )

            if result is None:
                return None

            # result is the job ID; get the job data
            job_data_raw = self._redis.hgetall(f"bull:review:{result}")
            if not job_data_raw:
                return None

            data = json.loads(job_data_raw.get("data", "{}"))
            return {"bull_job_id": result, "data": data}

        except Exception as e:
            logger.error("Queue poll error: %s", str(e))
            return None

    def start(self):
        """Start the worker loop."""
        self._running = True
        logger.info("Review worker started, polling queue...")

        while self._running:
            job = self.poll_queue()
            if job:
                try:
                    self.process_job(job["data"])
                except Exception as e:
                    logger.error("Worker error: %s", str(e), exc_info=True)
                finally:
                    # Remove from active list
                    try:
                        self._redis.lrem(
                            "bull:review:active", 1, job["bull_job_id"]
                        )
                    except Exception:
                        pass

    def stop(self):
        self._running = False
        logger.info("Review worker stopping...")
