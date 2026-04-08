"""
Tests for StructureAgent — output parsing and run() contract.

All LLM calls are mocked via patch on LLMFactory.create_chat_model.
"""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import (
    FakeChatMessage,
    make_fake_llm,
    make_findings_json,
    make_findings_json_wrapped,
)
from src.application.agents.structure import StructureAgent
from src.domain.entities import ReviewState


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def agent() -> StructureAgent:
    return StructureAgent()


@pytest.fixture
def valid_finding() -> dict:
    return {
        "type": "STRUCTURE",
        "severity": "WARNING",
        "message": "Falta la seccion de introduccion.",
        "suggestion": "Incluya una introduccion al capitulo.",
        "textFragment": None,
        "offsetStart": None,
        "offsetEnd": None,
        "sourceReference": {
            "layer": "INSTITUTIONAL",
            "chunkId": "chunk-abc",
            "documentTitle": "Guia UPB",
            "section": "Estructura",
        },
    }


# ---------------------------------------------------------------------------
# agent_type / findings_key contract
# ---------------------------------------------------------------------------


class TestStructureAgentContract:
    def test_agent_type(self, agent):
        assert agent.agent_type == "STRUCTURE"

    def test_findings_key(self, agent):
        assert agent.findings_key == "structure_findings"

    def test_is_base_agent_subclass(self, agent):
        from src.application.agents.base import BaseAgent

        assert isinstance(agent, BaseAgent)


# ---------------------------------------------------------------------------
# run() — happy path
# ---------------------------------------------------------------------------


class TestStructureAgentRun:
    def test_run_returns_structure_findings(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert "structure_findings" in result
        assert isinstance(result["structure_findings"], list)
        assert len(result["structure_findings"]) == 1

    def test_run_finding_has_correct_type(self, agent, minimal_state, valid_finding):
        fake_llm = make_fake_llm(make_findings_json([valid_finding]))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        finding = result["structure_findings"][0]
        assert finding["type"] == "STRUCTURE"

    def test_run_strips_markdown_code_fence(self, agent, minimal_state, valid_finding):
        """Parser must strip ```json ... ``` wrappers from the LLM response."""
        wrapped = make_findings_json_wrapped([valid_finding])
        fake_llm = make_fake_llm(wrapped)
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["structure_findings"]) == 1

    def test_run_accepts_wrapped_observations_object(
        self, agent, minimal_state, valid_finding
    ):
        """LLM sometimes returns {'observations': [...]}."""
        wrapped = json.dumps({"observations": [valid_finding]})
        fake_llm = make_fake_llm(wrapped)
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["structure_findings"]) == 1

    def test_run_empty_findings_list(self, agent, minimal_state):
        """Agent can return an empty array."""
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["structure_findings"] == []

    def test_run_multiple_findings(self, agent, minimal_state, valid_finding):
        findings = [valid_finding, {**valid_finding, "severity": "ERROR"}]
        fake_llm = make_fake_llm(make_findings_json(findings))
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert len(result["structure_findings"]) == 2


# ---------------------------------------------------------------------------
# run() — error / retry path
# ---------------------------------------------------------------------------


class TestStructureAgentErrors:
    def test_llm_exception_returns_empty_findings(self, agent, minimal_state):
        """After MAX_RETRIES, agent returns empty list and agent_errors."""
        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("API error")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["structure_findings"] == []
        assert "agent_errors" in result
        assert "STRUCTURE" in result["agent_errors"]

    def test_invalid_json_returns_empty_findings(self, agent, minimal_state):
        fake_llm = make_fake_llm("not json at all")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["structure_findings"] == []
        assert "STRUCTURE" in result.get("agent_errors", {})

    def test_timeout_returns_empty_findings(self, agent, minimal_state):
        import concurrent.futures

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = concurrent.futures.TimeoutError("timed out")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            result = agent.run(minimal_state)

        assert result["structure_findings"] == []


# ---------------------------------------------------------------------------
# Prompt generation
# ---------------------------------------------------------------------------


class TestStructureAgentPrompts:
    def test_system_prompt_contains_chapter_title(self, agent, minimal_state):
        prompt = agent.get_system_prompt(minimal_state)
        assert "Introduccion" in prompt

    def test_user_prompt_contains_chapter_number(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        assert "1" in prompt

    def test_user_prompt_contains_sections_json(self, agent, minimal_state):
        prompt = agent.get_user_prompt(minimal_state)
        # The sections should be serialised as JSON in the prompt
        assert "Introduccion" in prompt

    def test_rag_context_prepended_to_user_prompt(self, agent, state_with_rag):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            agent.run(state_with_rag)

        call_args = fake_llm.invoke.call_args[0][0]  # messages list
        human_content = call_args[1].content
        assert "Base de Conocimiento" in human_content

    def test_no_rag_context_adds_fallback_message(self, agent, minimal_state):
        fake_llm = make_fake_llm("[]")
        with patch(
            "src.application.agents.base.LLMFactory.create_chat_model",
            return_value=fake_llm,
        ):
            agent.run(minimal_state)

        call_args = fake_llm.invoke.call_args[0][0]
        human_content = call_args[1].content
        assert "No se encontraron referencias" in human_content
