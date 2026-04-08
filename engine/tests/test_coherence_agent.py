"""
Tests for CoherenceAgent — output parsing and run() contract.
"""

from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import make_fake_llm, make_findings_json, make_findings_json_wrapped
from src.application.agents.coherence import CoherenceAgent
from src.application.agents.base import BaseAgent


@pytest.fixture
def agent() -> CoherenceAgent:
    return CoherenceAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "COHERENCE",
        "severity": "WARNING",
        "message": "Existe una contradiccion entre la hipotesis planteada y las conclusiones intermedias.",
        "suggestion": "Revise la logica argumentativa del capitulo.",
        "textFragment": "la hipotesis no puede verificarse",
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": None,
    }


class TestCoherenceAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "COHERENCE"

    def test_findings_key(self, agent):
        assert agent.findings_key == "coherence_findings"

    def test_is_base_agent_subclass(self, agent):
        assert isinstance(agent, BaseAgent)


class TestCoherenceAgentRun:
    def test_run_returns_coherence_findings(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "coherence_findings" in result
        assert result["coherence_findings"][0]["type"] == "COHERENCE"

    def test_run_strips_code_fence(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json_wrapped([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["coherence_findings"]) == 1

    def test_run_empty_array_ok(self, agent, minimal_state):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["coherence_findings"] == []

    def test_run_llm_error_produces_agent_errors(self, agent, minimal_state):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = ValueError("broken")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "COHERENCE" in result.get("agent_errors", {})


class TestCoherenceAgentPrompts:
    def test_system_prompt_mentions_intra_chapter(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "INTRA-CAPITULO" in prompt

    def test_system_prompt_mentions_inter_chapter(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "INTER-CAPITULO" in prompt

    def test_system_prompt_lists_previous_chapters(
        self, agent, state_with_previous_chapters
    ):
        prompt = agent.get_system_prompt(state_with_previous_chapters)
        assert "Marco Teorico" in prompt

    def test_system_prompt_no_previous_chapters_fallback(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "No hay capitulos previos" in prompt

    def test_user_prompt_contains_document_text(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert minimal_state["document_text"] in prompt
