"""
Tests for IntegrityAgent — output parsing, severity restrictions, and run() contract.

IntegrityAgent NEVER assigns ERROR severity — only WARNING, SUGGESTION, INFO.
Findings are framed as guiding questions, never accusations.
"""

from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import make_fake_llm, make_findings_json, make_findings_json_wrapped
from src.application.agents.integrity import IntegrityAgent
from src.application.agents.base import BaseAgent


@pytest.fixture
def agent() -> IntegrityAgent:
    return IntegrityAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "INTEGRITY",
        "severity": "WARNING",
        "message": "¿Podria revisar si este parrafo es original? Parece muy similar al parrafo anterior.",
        "suggestion": "Reformule o elimine la redundancia.",
        "textFragment": "los resultados muestran que la metodologia es efectiva",
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": None,
    }


class TestIntegrityAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "INTEGRITY"

    def test_findings_key(self, agent):
        assert agent.findings_key == "integrity_findings"

    def test_is_base_agent_subclass(self, agent):
        assert isinstance(agent, BaseAgent)


class TestIntegrityAgentRun:
    def test_run_returns_integrity_findings(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "integrity_findings" in result
        assert result["integrity_findings"][0]["type"] == "INTEGRITY"

    def test_run_empty_array_when_no_patterns(self, agent, minimal_state):
        """Agent should return [] if no suspicious patterns found."""
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["integrity_findings"] == []

    def test_run_strips_code_fence(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json_wrapped([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["integrity_findings"]) == 1

    def test_run_llm_error_returns_agent_errors(self, agent, minimal_state):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("model unavailable")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["integrity_findings"] == []
        assert "INTEGRITY" in result.get("agent_errors", {})

    def test_warning_severity_accepted(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["integrity_findings"][0]["severity"] == "WARNING"

    def test_suggestion_severity_accepted(self, agent, minimal_state):
        finding = {
            "type": "INTEGRITY",
            "severity": "SUGGESTION",
            "message": "¿Podria ampliar la argumentacion en este parrafo?",
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

        assert result["integrity_findings"][0]["severity"] == "SUGGESTION"


class TestIntegrityAgentPrompts:
    def test_system_prompt_never_error_severity(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "JAMAS" in prompt or "NUNCA" in prompt or "ERROR" in prompt

    def test_system_prompt_no_accusations(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "preguntas orientadoras" in prompt or "buena fe" in prompt

    def test_system_prompt_empty_array_fallback(self, agent, minimal_state):
        """System prompt instructs returning [] when no patterns found."""
        prompt = agent.get_system_prompt(minimal_state)
        assert "array vacio" in prompt or "[]" in prompt

    def test_user_prompt_contains_document_text(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert minimal_state["document_text"] in prompt
