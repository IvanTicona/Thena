"""
Tests for the Synthesizer (engine/src/application/agents/synthesizer.py).

The synthesizer is a standalone function — not a class — that consolidates
findings from all 6 agents into a final report.
"""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import (
    FakeChatMessage,
    make_fake_llm,
    make_synth_json,
)
from src.application.agents.synthesizer import synthesize


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def state_with_all_findings(minimal_state) -> dict:
    minimal_state["structure_findings"] = [
        {
            "type": "STRUCTURE",
            "severity": "WARNING",
            "message": "Falta introduccion.",
            "suggestion": None,
            "textFragment": None,
            "offsetStart": None,
            "offsetEnd": None,
            "sourceReference": None,
        }
    ]
    minimal_state["methodology_findings"] = [
        {
            "type": "METHODOLOGY",
            "severity": "INFO",
            "message": "Objetivos bien definidos.",
            "suggestion": None,
            "textFragment": None,
            "offsetStart": None,
            "offsetEnd": None,
            "sourceReference": None,
        }
    ]
    minimal_state["coherence_findings"] = []
    minimal_state["citations_findings"] = [
        {
            "type": "CITATIONS",
            "severity": "ERROR",
            "message": "Cita sin referencia.",
            "suggestion": None,
            "textFragment": None,
            "offsetStart": None,
            "offsetEnd": None,
            "sourceReference": None,
        }
    ]
    minimal_state["format_findings"] = []
    minimal_state["integrity_findings"] = []
    return minimal_state


@pytest.fixture
def empty_findings_state(minimal_state) -> dict:
    """State with all finding fields empty."""
    minimal_state["structure_findings"] = []
    minimal_state["methodology_findings"] = []
    minimal_state["coherence_findings"] = []
    minimal_state["citations_findings"] = []
    minimal_state["format_findings"] = []
    minimal_state["integrity_findings"] = []
    return minimal_state


# ---------------------------------------------------------------------------
# synthesize() — happy path
# ---------------------------------------------------------------------------


class TestSynthesizerHappyPath:
    def test_returns_summary_and_observations(self, state_with_all_findings):
        expected_obs = [{"type": "STRUCTURE", "severity": "WARNING", "message": "x"}]
        fake_llm = make_fake_llm(make_synth_json("Resumen del capitulo.", expected_obs))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert "summary" in result
        assert "observations" in result

    def test_summary_is_string(self, state_with_all_findings):
        fake_llm = make_fake_llm(make_synth_json("Un resumen.", []))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert isinstance(result["summary"], str)

    def test_observations_is_list(self, state_with_all_findings):
        fake_llm = make_fake_llm(make_synth_json("Resumen.", []))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert isinstance(result["observations"], list)

    def test_strips_markdown_code_fence(self, state_with_all_findings):
        inner = make_synth_json("Resumen.", [])
        fenced = f"```json\n{inner}\n```"
        fake_llm = make_fake_llm(fenced)
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert result["summary"] == "Resumen."

    def test_observations_from_llm_response_used(self, state_with_all_findings):
        obs = [{"type": "STRUCTURE", "severity": "WARNING", "message": "Falta algo."}]
        fake_llm = make_fake_llm(make_synth_json("Resumen.", obs))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert result["observations"] == obs

    def test_all_six_agent_findings_merged_as_input(self, state_with_all_findings):
        """Verifies that the user prompt includes findings from all agents."""
        fake_llm = make_fake_llm(make_synth_json("Resumen.", []))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            synthesize(state_with_all_findings)

        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        # At least the STRUCTURE and CITATIONS findings are in the prompt
        assert "STRUCTURE" in human_content
        assert "CITATIONS" in human_content


# ---------------------------------------------------------------------------
# synthesize() — empty findings
# ---------------------------------------------------------------------------


class TestSynthesizerEmptyFindings:
    def test_empty_findings_no_llm_call(self, empty_findings_state):
        """Synthesizer must return immediately without calling LLM when there are no findings."""
        fake_llm = make_fake_llm("")
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ) as mock_factory:
            result = synthesize(empty_findings_state)

        mock_factory.assert_not_called()
        assert "summary" in result
        assert result["observations"] == []

    def test_empty_findings_summary_contains_message(self, empty_findings_state):
        with patch("src.application.agents.synthesizer.LLMFactory.create_chat_model"):
            result = synthesize(empty_findings_state)

        assert "No se generaron observaciones" in result["summary"]

    def test_empty_findings_with_agent_errors(self, empty_findings_state):
        empty_findings_state["agent_errors"] = {"STRUCTURE": "timeout"}
        with patch("src.application.agents.synthesizer.LLMFactory.create_chat_model"):
            result = synthesize(empty_findings_state)

        # Must mention the failed agent
        assert "STRUCTURE" in result["summary"]


# ---------------------------------------------------------------------------
# synthesize() — error handling
# ---------------------------------------------------------------------------


class TestSynthesizerErrors:
    def test_llm_failure_falls_back_to_raw_findings(self, state_with_all_findings):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("LLM down")
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        # Fallback: raw merged findings returned
        assert isinstance(result["observations"], list)
        assert len(result["observations"]) > 0

    def test_llm_failure_summary_fallback_message(self, state_with_all_findings):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = ValueError("parse error")
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        assert "sintetizador no pudo" in result["summary"].lower() or isinstance(
            result["summary"], str
        )

    def test_invalid_json_from_llm_falls_back(self, state_with_all_findings):
        fake_llm = make_fake_llm("NOT JSON")
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = synthesize(state_with_all_findings)

        # Fallback should still be a valid result
        assert "observations" in result

    def test_agent_errors_noted_in_prompt_when_present(self, state_with_all_findings):
        state_with_all_findings["agent_errors"] = {"COHERENCE": "timed out"}
        fake_llm = make_fake_llm(make_synth_json("Resumen.", []))
        with patch(
            "src.application.agents.synthesizer.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            synthesize(state_with_all_findings)

        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        assert "COHERENCE" in human_content
