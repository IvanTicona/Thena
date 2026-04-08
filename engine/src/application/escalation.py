"""
Escalation service for Thena Engine.

After a review completes, this module compares observations from the CURRENT
submission version with observations from previous versions of the same chapter.

An observation is considered "recurring" if:
  - It has the same AgentType (type field)
  - Its message is at least 70% similar to a previous observation's message
    (using difflib.SequenceMatcher)

If an observation recurs across 3+ consecutive versions, its escalation_level
is incremented in the database.

If any observation reaches escalation_level >= 3, a notification is inserted
directly into the notifications table for the tutor.
"""

import json
import logging
import uuid
from difflib import SequenceMatcher

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Minimum similarity ratio to consider two observation messages as matching
SIMILARITY_THRESHOLD = 0.70

# Escalation level that triggers a notification to the tutor
ESCALATION_NOTIFY_THRESHOLD = 3


def _similarity(a: str, b: str) -> float:
    """Return the similarity ratio between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def check_escalation(
    db_engine: Engine,
    chapter_id: str,
    current_version_number: int,
) -> None:
    """
    Check and update escalation levels for observations in the current version.

    This function is resilient — any failure is logged but never propagates
    so it never breaks the review result.

    Args:
        db_engine: SQLAlchemy engine for raw DB access.
        chapter_id: UUID of the chapter being reviewed.
        current_version_number: Version number of the current submission.
    """
    try:
        _run_escalation_check(db_engine, chapter_id, current_version_number)
    except Exception as exc:
        logger.error(
            "Escalation check failed for chapter %s v%d: %s",
            chapter_id,
            current_version_number,
            exc,
            exc_info=True,
        )


def _run_escalation_check(
    db_engine: Engine,
    chapter_id: str,
    current_version_number: int,
) -> None:
    """Inner implementation — may raise; wrapped by check_escalation."""
    with db_engine.connect() as conn:
        # Fetch current version's observations
        current_obs = _get_observations_for_version(
            conn, chapter_id, current_version_number
        )
        if not current_obs:
            logger.debug(
                "No observations found for chapter %s v%d — skipping escalation",
                chapter_id,
                current_version_number,
            )
            return

        # Fetch observations from the previous version (if it exists)
        if current_version_number <= 1:
            logger.debug(
                "Chapter %s v%d is the first version — no escalation possible",
                chapter_id,
                current_version_number,
            )
            return

        previous_obs = _get_observations_for_version(
            conn, chapter_id, current_version_number - 1
        )
        if not previous_obs:
            return

        # For each current observation, check if it matches a previous one
        escalated_obs: list[dict] = []

        for curr in current_obs:
            for prev in previous_obs:
                if curr["type"] != prev["type"]:
                    continue
                sim = _similarity(curr["message"], prev["message"])
                if sim >= SIMILARITY_THRESHOLD:
                    # Recurring observation: new level = previous level + 1
                    new_level = (prev["escalation_level"] or 0) + 1
                    escalated_obs.append(
                        {
                            "obs_id": curr["id"],
                            "new_level": new_level,
                            "message": curr["message"],
                            "type": curr["type"],
                        }
                    )
                    break  # Only match once per current observation

        if not escalated_obs:
            return

    # Write escalation levels and trigger notifications (separate transactions)
    with db_engine.begin() as conn:
        for item in escalated_obs:
            conn.execute(
                text("""
                    UPDATE observations
                    SET escalation_level = :level
                    WHERE id = CAST(:obs_id AS uuid)
                """),
                {"level": item["new_level"], "obs_id": item["obs_id"]},
            )
            logger.info(
                "Escalated observation %s to level %d",
                item["obs_id"],
                item["new_level"],
            )

    # Fire notifications for observations that reached the threshold
    high_escalations = [
        o for o in escalated_obs if o["new_level"] >= ESCALATION_NOTIFY_THRESHOLD
    ]
    if high_escalations:
        _send_escalation_notifications(
            db_engine, chapter_id, current_version_number, high_escalations
        )


def _get_observations_for_version(
    conn,
    chapter_id: str,
    version_number: int,
) -> list[dict]:
    """
    Fetch observations for a specific chapter version.

    Returns a list of dicts with: id, type, message, escalation_level.
    """
    rows = conn.execute(
        text("""
            SELECT
                o.id::text,
                o.type::text,
                o.message,
                o.escalation_level
            FROM observations o
            JOIN review_reports rr ON rr.id = o.review_report_id
            JOIN review_jobs rj ON rj.id = rr.review_job_id
            JOIN submissions s ON s.id = rj.submission_id
            WHERE s.chapter_id = CAST(:chapter_id AS uuid)
              AND s.version_number = :version_number
        """),
        {"chapter_id": chapter_id, "version_number": version_number},
    ).fetchall()

    return [
        {
            "id": row.id,
            "type": row.type,
            "message": row.message,
            "escalation_level": row.escalation_level or 0,
        }
        for row in rows
    ]


def _send_escalation_notifications(
    db_engine: Engine,
    chapter_id: str,
    version_number: int,
    escalated_obs: list[dict],
) -> None:
    """
    Insert ESCALATION_ALERT notifications for the tutor when observations
    reach or exceed the escalation threshold.
    """
    try:
        with db_engine.connect() as conn:
            # Get chapter info: number, thesis title, student name, tutor_id
            row = conn.execute(
                text("""
                    SELECT
                        c.number AS chapter_number,
                        u_student.name AS student_name,
                        td.tutor_id::text
                    FROM chapters c
                    JOIN thesis_documents td ON td.id = c.thesis_id
                    JOIN users u_student ON u_student.id = td.student_id
                    WHERE c.id = CAST(:chapter_id AS uuid)
                """),
                {"chapter_id": chapter_id},
            ).fetchone()

        if not row or not row.tutor_id:
            logger.warning(
                "Cannot send escalation notification: chapter %s has no tutor",
                chapter_id,
            )
            return

        tutor_id = row.tutor_id
        student_name = row.student_name
        chapter_number = row.chapter_number

        with db_engine.begin() as conn:
            for obs in escalated_obs:
                notification_id = str(uuid.uuid4())
                title = "⚠️ Escalación: observación recurrente detectada"
                body = (
                    f"El estudiante {student_name} tiene una observación que persiste "
                    f"en {obs['new_level']} versiones consecutivas en el Capítulo {chapter_number}"
                )
                metadata = json.dumps(
                    {
                        "chapterId": chapter_id,
                        "versionNumber": version_number,
                        "escalationLevel": obs["new_level"],
                        "observationType": obs["type"],
                    }
                )

                conn.execute(
                    text("""
                        INSERT INTO notifications (
                            id, user_id, type, title, body, read, metadata, created_at
                        ) VALUES (
                            CAST(:id AS uuid),
                            CAST(:user_id AS uuid),
                            CAST('ESCALATION_ALERT' AS "NotificationType"),
                            :title,
                            :body,
                            false,
                            CAST(:metadata AS jsonb),
                            NOW()
                        )
                    """),
                    {
                        "id": notification_id,
                        "user_id": tutor_id,
                        "title": title,
                        "body": body,
                        "metadata": metadata,
                    },
                )

                logger.info(
                    "Escalation notification sent to tutor %s for chapter %s v%d (level %d)",
                    tutor_id,
                    chapter_id,
                    version_number,
                    obs["new_level"],
                )

    except Exception as exc:
        logger.error(
            "Failed to send escalation notifications for chapter %s: %s",
            chapter_id,
            exc,
            exc_info=True,
        )
