"""
Tests for MethodologyAgent — output parsing and run() contract.
"""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import make_fake_llm, make_findings_json, make_findings_json_wrapped
from src.application.agents.methodology import MethodologyAgent
from src.application.agents.base import BaseAgent


@pytest.fixture
def agent() -> MethodologyAgent:
    return MethodologyAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "METHODOLOGY",
        "severity": "WARNING",
        "message": "Los objetivos especificos no guardan coherencia con la metodologia descrita.",
        "suggestion": "Revise la alineacion entre cada objetivo especifico y el metodo empleado.",
        "textFragment": None,
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": None,
    }


class TestMethodologyAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "METHODOLOGY"

    def test_findings_key(self, agent):
        assert agent.findings_key == "methodology_findings"

    def test_is_base_agent_subclass(self, agent):
        assert isinstance(agent, BaseAgent)


class TestMethodologyAgentRun:
    def test_run_returns_methodology_findings(
        self, agent, minimal_state, valid_finding
    ):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "methodology_findings" in result
        assert len(result["methodology_findings"]) == 1

    def test_run_strips_code_fence(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json_wrapped([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["methodology_findings"]) == 1

    def test_run_empty_findings(self, agent, minimal_state):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["methodology_findings"] == []

    def test_run_llm_error_returns_agent_errors(self, agent, minimal_state):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("fail")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["methodology_findings"] == []
        assert "METHODOLOGY" in result.get("agent_errors", {})


class TestMethodologyAgentPrompts:
    def test_user_prompt_contains_document_text(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert minimal_state["document_text"] in prompt

    def test_user_prompt_includes_previous_chapters(
        self, agent, state_with_previous_chapters
    ):
        prompt = agent.get_user_prompt(state_with_previous_chapters)
        assert "Marco Teorico" in prompt

    def test_system_prompt_mentions_chapter_title(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "Introduccion" in prompt

    def test_previous_chapters_included_in_prompt(
        self, agent, state_with_previous_chapters
    ):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            agent.run(state_with_previous_chapters)

        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        assert "Marco Teorico" in human_content
