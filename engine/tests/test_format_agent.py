"""
Tests for FormatAgent — output parsing, severity restrictions, and run() contract.

FormatAgent is NOT allowed to emit ERROR severity — only WARNING, SUGGESTION, INFO.
"""

from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import make_fake_llm, make_findings_json, make_findings_json_wrapped
from src.application.agents.format import FormatAgent
from src.application.agents.base import BaseAgent


@pytest.fixture
def agent() -> FormatAgent:
    return FormatAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "FORMAT",
        "severity": "WARNING",
        "message": "El titulo del capitulo no sigue la jerarquia de Heading 1 segun los lineamientos.",
        "suggestion": "Use Heading 1 para el titulo principal del capitulo.",
        "textFragment": None,
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": {
            "layer": "INSTITUTIONAL",
            "chunkId": "chunk-fmt-1",
            "documentTitle": "Guia de Formato UPB",
            "section": "Titulos",
        },
    }


class TestFormatAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "FORMAT"

    def test_findings_key(self, agent):
        assert agent.findings_key == "format_findings"

    def test_is_base_agent_subclass(self, agent):
        assert isinstance(agent, BaseAgent)


class TestFormatAgentRun:
    def test_run_returns_format_findings(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "format_findings" in result
        assert result["format_findings"][0]["type"] == "FORMAT"

    def test_run_strips_code_fence(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json_wrapped([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["format_findings"]) == 1

    def test_run_empty_ok(self, agent, minimal_state):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["format_findings"] == []

    def test_run_llm_error_produces_agent_errors(self, agent, minimal_state):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = Exception("timeout")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "FORMAT" in result.get("agent_errors", {})

    def test_suggestion_finding_accepted(self, agent, minimal_state):
        finding = {
            "type": "FORMAT",
            "severity": "SUGGESTION",
            "message": "El espaciado entre parrafos es inconsistente.",
            "suggestion": None,
            "textFragment": None,
            "offsetStart": None,
            "offsetEnd": None,
            "sourceReference": None,
        }
        fake_llm = make_fake_llm(make_findings_json([finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["format_findings"][0]["severity"] == "SUGGESTION"


class TestFormatAgentPrompts:
    def test_system_prompt_no_error_severity(self, agent, minimal_state):
        """System prompt explicitly states no ERROR severity for format agent."""
        prompt = agent.get_system_prompt(minimal_state)
        assert "NO uses ERROR" in prompt

    def test_system_prompt_criteria_mentioned(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "tipografica" in prompt or "Consistencia" in prompt

    def test_user_prompt_contains_sections_json(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        # The sections are serialized as JSON in the prompt
        assert "Introduccion" in prompt

    def test_user_prompt_contains_document_text(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert minimal_state["document_text"] in prompt
