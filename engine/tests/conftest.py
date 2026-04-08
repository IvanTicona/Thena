"""
Shared pytest fixtures and mock LLM factory for Thena engine tests.

ALL LLM calls are mocked — no real OpenAI/Gemini API calls in any test.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class FakeChatMessage:
    """Minimal stand-in for a langchain BaseMessage response."""

    def __init__(self, content: str) -> None:
        self.content = content


def make_fake_llm(response_content: str) -> MagicMock:
    """Return a mock LLM whose .invoke() returns a FakeChatMessage."""
    llm = MagicMock()
    llm.invoke.return_value = FakeChatMessage(content=response_content)
    return llm


def make_findings_json(findings: list[dict[str, Any]]) -> str:
    """Serialize a list of finding dicts as the JSON string an LLM would return."""
    return json.dumps(findings, ensure_ascii=False)


def make_findings_json_wrapped(findings: list[dict[str, Any]]) -> str:
    """Same but wrapped in a markdown code fence — tests strip-fence logic."""
    inner = json.dumps(findings, ensure_ascii=False)
    return f"```json\n{inner}\n```"


def make_synth_json(
    summary: str,
    observations: list[dict[str, Any]],
) -> str:
    return json.dumps(
        {
            "summary": summary,
            "observations": observations,
            "totalObservations": len(observations),
            "bySeverity": {},
        },
        ensure_ascii=False,
    )


# ---------------------------------------------------------------------------
# Common state fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def minimal_state() -> dict:
    """Minimal ReviewState with just the required fields."""
    return {
        "submission_id": "sub-001",
        "chapter_number": 1,
        "chapter_title": "Introduccion",
        "document_text": "Este es el texto del capitulo introductorio.",
        "document_sections": [
            {
                "heading": "Introduccion",
                "level": 1,
                "content": "Este es el texto del capitulo introductorio.",
                "offset_start": 0,
                "offset_end": 46,
            }
        ],
        "markdown_content": "# Introduccion\n\nEste es el texto del capitulo introductorio.",
        "previous_chapters": [],
        "rag_context": [],
        "bibliography_context": [],
        "tutor_id": None,
    }


@pytest.fixture
def state_with_rag(minimal_state) -> dict:
    """State that includes RAG context chunks."""
    minimal_state["rag_context"] = [
        {
            "chunk_id": "chunk-1",
            "content": "Los capitulos deben tener introduccion, desarrollo y conclusion.",
            "metadata": {"section": "Estructura General"},
            "document_title": "Guia UPB",
            "layer": "INSTITUTIONAL",
            "section": "Estructura General",
            "similarity": 0.92,
        }
    ]
    return minimal_state


@pytest.fixture
def state_with_bibliography(minimal_state) -> dict:
    """State that includes bibliography context chunks."""
    minimal_state["bibliography_context"] = [
        {
            "chunk_id": "bib-1",
            "content": "Smith, J. (2020). Academic Writing. Oxford University Press.",
            "metadata": {"section": "Referencia"},
            "document_title": "Smith 2020",
            "layer": "BIBLIOGRAPHY",
            "section": "Referencia",
            "similarity": 0.88,
        }
    ]
    return minimal_state


@pytest.fixture
def state_with_previous_chapters(minimal_state) -> dict:
    """State that includes previously approved chapters."""
    minimal_state["previous_chapters"] = [
        {
            "chapter_number": 1,
            "chapter_title": "Marco Teorico",
            "markdown_content": "# Marco Teorico\n\nContenido del marco teorico aprobado.",
        }
    ]
    return minimal_state


# ---------------------------------------------------------------------------
# Sample findings
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_structure_finding() -> dict:
    return {
        "type": "STRUCTURE",
        "severity": "WARNING",
        "message": "Falta la seccion de conclusiones del capitulo.",
        "suggestion": "Agregue una seccion de conclusiones al final del capitulo.",
        "textFragment": None,
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": {
            "layer": "INSTITUTIONAL",
            "chunkId": "chunk-1",
            "documentTitle": "Guia UPB",
            "section": "Estructura General",
        },
    }


@pytest.fixture
def sample_citations_finding() -> dict:
    return {
        "type": "CITATIONS",
        "severity": "ERROR",
        "message": "Afirmacion sin respaldo bibliografico detectada.",
        "suggestion": None,
        "textFragment": "los humanos siempre aprenden mejor con ejemplos visuales",
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": {
            "layer": "BIBLIOGRAPHY",
            "chunkId": "bib-1",
            "documentTitle": "Smith 2020",
            "section": "Referencia",
        },
    }
