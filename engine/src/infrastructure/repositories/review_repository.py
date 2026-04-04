import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import text, Connection
from sqlalchemy.engine import Engine

from src.domain.entities import FindingDict, ChapterInfoDict, PreviousChapterDict
from src.domain.ports import ReviewRepositoryPort

logger = logging.getLogger(__name__)


class ReviewRepository(ReviewRepositoryPort):
    def __init__(self, db_engine: Engine) -> None:
        self._db_engine = db_engine

    # ── Read operations ─────────────────────────────────────────────

    def get_chapter_info(self, chapter_id: str) -> ChapterInfoDict:
        """Fetch chapter metadata and associated tutor via thesis_documents."""
        with self._db_engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT
                        c.number AS chapter_number,
                        c.title,
                        td.student_id,
                        td.tutor_id
                    FROM chapters c
                    JOIN thesis_documents td ON c.thesis_id = td.id
                    WHERE c.id = CAST(:chapter_id AS uuid)
                """),
                {"chapter_id": chapter_id},
            ).fetchone()

            if not row:
                raise ValueError(f"Chapter {chapter_id} not found")

            return {
                "chapter_number": row.chapter_number,
                "chapter_title": row.title,
                "student_id": str(row.student_id),
                "tutor_id": str(row.tutor_id) if row.tutor_id else None,
            }

    def get_approved_chapters(self, chapter_id: str) -> list[PreviousChapterDict]:
        """Get all previously approved chapters for the same thesis."""
        with self._db_engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT c.number AS chapter_number, c.title, s.markdown_content
                    FROM chapters c
                    JOIN submissions s ON s.chapter_id = c.id
                    WHERE c.thesis_id = (
                        SELECT thesis_id FROM chapters
                        WHERE id = CAST(:chapter_id AS uuid)
                    )
                    AND c.status = 'APPROVED'
                    AND s.markdown_content IS NOT NULL
                    ORDER BY c.number
                """),
                {"chapter_id": chapter_id},
            )

            return [
                {
                    "chapter_number": row.chapter_number,
                    "chapter_title": row.title,
                    "markdown_content": row.markdown_content,
                }
                for row in result
            ]

    # ── Write operations ────────────────────────────────────────────

    def update_job_status(
        self, job_id: str, status: str, error_message: str | None = None
    ) -> None:
        """Update the status of a review job."""
        with self._db_engine.begin() as conn:
            params: dict[str, str | None] = {"job_id": job_id, "status": status}

            if status == "PROCESSING":
                conn.execute(
                    text("""
                        UPDATE review_jobs
                        SET status = :status, started_at = NOW()
                        WHERE id = CAST(:job_id AS uuid)
                    """),
                    params,
                )
            elif status in ("COMPLETED", "FAILED"):
                params["error_message"] = error_message
                conn.execute(
                    text("""
                        UPDATE review_jobs
                        SET status = :status,
                            completed_at = NOW(),
                            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
                            error_message = :error_message
                        WHERE id = CAST(:job_id AS uuid)
                    """),
                    params,
                )

    def update_submission_markdown(self, submission_id: str, markdown: str) -> None:
        """Store the parsed markdown content for a submission."""
        with self._db_engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE submissions
                    SET markdown_content = :markdown
                    WHERE id = CAST(:submission_id AS uuid)
                """),
                {"submission_id": submission_id, "markdown": markdown},
            )

    def save_results(
        self,
        job_id: str,
        summary: str,
        observations: list[FindingDict],
        agent_findings: dict[str, list[FindingDict]],
    ) -> None:
        """Save agent results, review report, and observations to the database."""
        with self._db_engine.begin() as conn:
            self._cleanup_previous_results(conn, job_id)

            by_severity = self._count_by_severity(observations)

            report_id = str(uuid.uuid4())
            self._insert_report(
                conn, report_id, job_id, summary, observations, by_severity
            )

            agent_result_ids = self._insert_agent_results(conn, job_id, agent_findings)

            self._insert_observations(conn, observations, agent_result_ids, report_id)

        logger.info(
            "Saved results for job %s: %d observations", job_id, len(observations)
        )

    # ── Private helpers ─────────────────────────────────────────────

    @staticmethod
    def _cleanup_previous_results(conn: Connection, job_id: str) -> None:
        """Remove any partial results from a previous attempt."""
        conn.execute(
            text("""
                DELETE FROM observations
                WHERE review_report_id IN (
                    SELECT id FROM review_reports
                    WHERE review_job_id = CAST(:job_id AS uuid)
                )
            """),
            {"job_id": job_id},
        )
        conn.execute(
            text(
                "DELETE FROM agent_results WHERE review_job_id = CAST(:job_id AS uuid)"
            ),
            {"job_id": job_id},
        )
        conn.execute(
            text(
                "DELETE FROM review_reports WHERE review_job_id = CAST(:job_id AS uuid)"
            ),
            {"job_id": job_id},
        )

    @staticmethod
    def _count_by_severity(observations: list[FindingDict]) -> dict[str, int]:
        by_severity: dict[str, int] = {
            "INFO": 0,
            "SUGGESTION": 0,
            "WARNING": 0,
            "ERROR": 0,
        }
        for obs in observations:
            sev = obs.get("severity", "INFO")
            if sev in by_severity:
                by_severity[sev] += 1
        return by_severity

    @staticmethod
    def _insert_report(
        conn: Connection,
        report_id: str,
        job_id: str,
        summary: str,
        observations: list[FindingDict],
        by_severity: dict[str, int],
    ) -> None:
        conn.execute(
            text("""
                INSERT INTO review_reports (
                    id, review_job_id, summary_text,
                    total_observations, by_severity
                ) VALUES (
                    CAST(:id AS uuid), CAST(:job_id AS uuid), :summary,
                    :total, CAST(:by_severity AS jsonb)
                )
            """),
            {
                "id": report_id,
                "job_id": job_id,
                "summary": summary,
                "total": len(observations),
                "by_severity": json.dumps(by_severity),
            },
        )

    @staticmethod
    def _insert_agent_results(
        conn: Connection,
        job_id: str,
        agent_findings: dict[str, list[FindingDict]],
    ) -> dict[str, str]:
        agent_type_map = {
            "structure_findings": "STRUCTURE",
            "methodology_findings": "METHODOLOGY",
            "coherence_findings": "COHERENCE",
        }

        agent_result_ids: dict[str, str] = {}
        for findings_key, agent_type in agent_type_map.items():
            findings = agent_findings.get(findings_key, [])
            ar_id = str(uuid.uuid4())
            agent_result_ids[agent_type] = ar_id

            status = "COMPLETED" if findings else "FAILED"
            conn.execute(
                text("""
                    INSERT INTO agent_results (
                        id, review_job_id, agent_type, status,
                        findings, started_at, completed_at
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:job_id AS uuid),
                        CAST(:agent_type AS "AgentType"),
                        CAST(:status AS "AgentStatus"),
                        CAST(:findings AS jsonb), NOW(), NOW()
                    )
                """),
                {
                    "id": ar_id,
                    "job_id": job_id,
                    "agent_type": agent_type,
                    "status": status,
                    "findings": json.dumps(findings, ensure_ascii=False),
                },
            )

        return agent_result_ids

    @staticmethod
    def _insert_observations(
        conn: Connection,
        observations: list[FindingDict],
        agent_result_ids: dict[str, str],
        report_id: str,
    ) -> None:
        for obs in observations:
            obs_type = obs.get("type", "STRUCTURE")
            agent_result_id = agent_result_ids.get(
                obs_type, next(iter(agent_result_ids.values()))
            )

            conn.execute(
                text("""
                    INSERT INTO observations (
                        id, agent_result_id, review_report_id,
                        type, severity, message, suggestion,
                        text_fragment, offset_start, offset_end,
                        source_reference
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:ar_id AS uuid),
                        CAST(:report_id AS uuid),
                        CAST(:type AS "AgentType"),
                        CAST(:severity AS "ObservationSeverity"),
                        :message, :suggestion,
                        :text_fragment, :offset_start, :offset_end,
                        CAST(:source_reference AS jsonb)
                    )
                """),
                {
                    "id": str(uuid.uuid4()),
                    "ar_id": agent_result_id,
                    "report_id": report_id,
                    "type": obs_type,
                    "severity": obs.get("severity", "INFO"),
                    "message": obs.get("message", ""),
                    "suggestion": obs.get("suggestion"),
                    "text_fragment": obs.get("textFragment"),
                    "offset_start": obs.get("offsetStart"),
                    "offset_end": obs.get("offsetEnd"),
                    "source_reference": json.dumps(obs.get("sourceReference"))
                    if obs.get("sourceReference")
                    else None,
                },
            )
