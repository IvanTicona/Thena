import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.engine import Engine


class ReviewRepository:
    def __init__(self, db_engine: Engine):
        self._db_engine = db_engine

    def update_job_status(
        self, job_id: str, status: str, error_message: str | None = None
    ):
        with self._db_engine.begin() as conn:
            params: dict = {"job_id": job_id, "status": status}

            if status == "PROCESSING":
                conn.execute(
                    text("""
                        UPDATE review_jobs
                        SET status = :status, started_at = NOW()
                        WHERE id = :job_id::uuid
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
                        WHERE id = :job_id::uuid
                    """),
                    params,
                )

    def update_submission_markdown(self, submission_id: str, markdown: str):
        with self._db_engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE submissions
                    SET markdown_content = :markdown
                    WHERE id = :submission_id::uuid
                """),
                {"submission_id": submission_id, "markdown": markdown},
            )

    def get_approved_chapters(self, chapter_id: str) -> list[dict]:
        """Get all previously approved chapters for the same project."""
        with self._db_engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT c.chapter_number, c.title, s.markdown_content
                    FROM chapters c
                    JOIN submissions s ON s.chapter_id = c.id
                    JOIN review_jobs rj ON rj.submission_id = s.id
                    WHERE c.project_id = (
                        SELECT project_id FROM chapters WHERE id = :chapter_id::uuid
                    )
                    AND c.status = 'APPROVED'
                    AND s.markdown_content IS NOT NULL
                    ORDER BY c.chapter_number
                """),
                {"chapter_id": chapter_id},
            )

            chapters = []
            for row in result:
                chapters.append(
                    {
                        "chapter_number": row.chapter_number,
                        "chapter_title": row.title,
                        "markdown_content": row.markdown_content,
                    }
                )
            return chapters

    def get_chapter_info(self, chapter_id: str) -> dict:
        with self._db_engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT c.chapter_number, c.title, c.project_id,
                           p.tutor_id
                    FROM chapters c
                    JOIN projects p ON p.id = c.project_id
                    WHERE c.id = :chapter_id::uuid
                """),
                {"chapter_id": chapter_id},
            ).fetchone()

            if not row:
                raise ValueError(f"Chapter {chapter_id} not found")

            return {
                "chapter_number": row.chapter_number,
                "chapter_title": row.title,
                "project_id": str(row.project_id),
                "tutor_id": str(row.tutor_id) if row.tutor_id else None,
            }

    def save_results(
        self,
        job_id: str,
        summary: str,
        observations: list[dict],
        agent_findings: dict[str, list[dict]],
    ):
        """Save agent results, review report, and observations to the database."""
        with self._db_engine.begin() as conn:
            # Count by severity
            by_severity = {"INFO": 0, "SUGGESTION": 0, "WARNING": 0, "ERROR": 0}
            for obs in observations:
                sev = obs.get("severity", "INFO")
                if sev in by_severity:
                    by_severity[sev] += 1

            # Create ReviewReport
            report_id = str(uuid.uuid4())
            conn.execute(
                text("""
                    INSERT INTO review_reports (id, review_job_id, summary_text, total_observations, by_severity)
                    VALUES (:id::uuid, :job_id::uuid, :summary, :total, :by_severity::jsonb)
                """),
                {
                    "id": report_id,
                    "job_id": job_id,
                    "summary": summary,
                    "total": len(observations),
                    "by_severity": json.dumps(by_severity),
                },
            )

            # Create AgentResults and Observations
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
                        INSERT INTO agent_results (id, review_job_id, agent_type, status, findings, started_at, completed_at)
                        VALUES (:id::uuid, :job_id::uuid, :agent_type::\"AgentType\", :status::\"AgentStatus\", :findings::jsonb, NOW(), NOW())
                    """),
                    {
                        "id": ar_id,
                        "job_id": job_id,
                        "agent_type": agent_type,
                        "status": status,
                        "findings": json.dumps(findings, ensure_ascii=False),
                    },
                )

            # Save observations
            for obs in observations:
                obs_type = obs.get("type", "STRUCTURE")
                agent_result_id = agent_result_ids.get(obs_type, list(agent_result_ids.values())[0])

                conn.execute(
                    text("""
                        INSERT INTO observations (
                            id, agent_result_id, review_report_id,
                            type, severity, message, suggestion,
                            text_fragment, offset_start, offset_end,
                            source_reference
                        ) VALUES (
                            :id::uuid, :ar_id::uuid, :report_id::uuid,
                            :type::\"AgentType\", :severity::\"ObservationSeverity\", :message, :suggestion,
                            :text_fragment, :offset_start, :offset_end,
                            :source_reference::jsonb
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
