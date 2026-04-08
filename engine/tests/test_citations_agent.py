"""
Tests for CitationsAgent — output parsing, bibliography_context injection, and run() contract.

CitationsAgent is special: it overrides run() to swap bibliography_context → rag_context
in a shallow copy of the state, so the base class formats it as knowledge-base context.
"""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock, call

import pytest

from tests.conftest import make_fake_llm, make_findings_json, make_findings_json_wrapped
from src.application.agents.citations import CitationsAgent
from src.application.agents.base import BaseAgent


@pytest.fixture
def agent() -> CitationsAgent:
    return CitationsAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "CITATIONS",
        "severity": "ERROR",
        "message": "Afirmacion sin respaldo bibliografico.",
        "suggestion": "Cite la fuente correspondiente.",
        "textFragment": "los estudios demuestran que",
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": {
            "layer": "BIBLIOGRAPHY",
            "chunkId": "bib-1",
            "documentTitle": "Smith 2020",
            "section": "Referencia",
        },
    }


class TestCitationsAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "CITATIONS"

    def test_findings_key(self, agent):
        assert agent.findings_key == "citations_findings"

    def test_is_base_agent_subclass(self, agent):
        assert isinstance(agent, BaseAgent)


class TestCitationsAgentRun:
    def test_run_returns_citations_findings(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "citations_findings" in result
        assert result["citations_findings"][0]["type"] == "CITATIONS"

    def test_run_strips_code_fence(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json_wrapped([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["citations_findings"]) == 1

    def test_run_empty_bibliography_context(self, agent, minimal_state):
        """With no bibliography_context, the no-knowledge-base fallback message appears."""
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["citations_findings"] == []
        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        assert "No se encontraron referencias" in human_content

    def test_bibliography_context_injected_as_rag_context(
        self, agent, state_with_bibliography
    ):
        """bibliography_context must be exposed as rag_context to the base class."""
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            agent.run(state_with_bibliography)

        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        # The bibliography chunk content should appear in the prompt
        assert "Smith" in human_content or "Base de Conocimiento" in human_content

    def test_run_does_not_mutate_original_state(self, agent, state_with_bibliography):
        """The shallow copy in CitationsAgent.run() must not mutate the caller's state."""
        original_rag = state_with_bibliography.get("rag_context", [])
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            agent.run(state_with_bibliography)

        assert state_with_bibliography.get("rag_context", []) == original_rag

    def test_run_llm_error_returns_agent_errors(self, agent, minimal_state):
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("network error")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["citations_findings"] == []
        assert "CITATIONS" in result.get("agent_errors", {})


class TestCitationsAgentPrompts:
    def test_system_prompt_mentions_apa7(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "APA" in prompt

    def test_system_prompt_severity_mapping(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "ERROR" in prompt
        assert "WARNING" in prompt
        assert "SUGGESTION" in prompt

    def test_user_prompt_contains_document_text(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert minimal_state["document_text"] in prompt
