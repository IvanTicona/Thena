from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langgraph.graph import StateGraph, START, END

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

from src.domain.entities import ReviewState, FindingDict
from src.application.agents.structure import StructureAgent
from src.application.agents.methodology import MethodologyAgent
from src.application.agents.coherence import CoherenceAgent
from src.application.agents.citations import CitationsAgent
from src.application.agents.format import FormatAgent
from src.application.agents.integrity import IntegrityAgent
from src.application.agents.synthesizer import synthesize

logger = logging.getLogger(__name__)

_structure_agent = StructureAgent()
_methodology_agent = MethodologyAgent()
_coherence_agent = CoherenceAgent()
_citations_agent = CitationsAgent()
_format_agent = FormatAgent()
_integrity_agent = IntegrityAgent()


def run_structure(state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info("Running Structure Agent for submission %s", state.get("submission_id"))
    return _structure_agent.run(state)


def run_methodology(
    state: ReviewState,
) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info(
        "Running Methodology Agent for submission %s", state.get("submission_id")
    )
    return _methodology_agent.run(state)


def run_coherence(state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info("Running Coherence Agent for submission %s", state.get("submission_id"))
    return _coherence_agent.run(state)


def run_citations(state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info("Running Citations Agent for submission %s", state.get("submission_id"))
    return _citations_agent.run(state)


def run_format(state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info("Running Format Agent for submission %s", state.get("submission_id"))
    return _format_agent.run(state)


def run_integrity(state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
    logger.info("Running Integrity Agent for submission %s", state.get("submission_id"))
    return _integrity_agent.run(state)


def run_synthesizer(state: ReviewState) -> dict[str, str | list[FindingDict]]:
    logger.info("Running Synthesizer for submission %s", state.get("submission_id"))
    return synthesize(state)


def build_review_graph() -> StateGraph:
    """Build the LangGraph review workflow with 6 parallel agents + synthesizer."""
    graph = StateGraph(ReviewState)

    # Add nodes
    graph.add_node("structure_agent", run_structure)
    graph.add_node("methodology_agent", run_methodology)
    graph.add_node("coherence_agent", run_coherence)
    graph.add_node("citations_agent", run_citations)
    graph.add_node("format_agent", run_format)
    graph.add_node("integrity_agent", run_integrity)
    graph.add_node("synthesizer", run_synthesizer)

    # Fan-out: START -> all 6 agents in parallel
    graph.add_edge(START, "structure_agent")
    graph.add_edge(START, "methodology_agent")
    graph.add_edge(START, "coherence_agent")
    graph.add_edge(START, "citations_agent")
    graph.add_edge(START, "format_agent")
    graph.add_edge(START, "integrity_agent")

    # Fan-in: all 6 agents -> synthesizer
    graph.add_edge("structure_agent", "synthesizer")
    graph.add_edge("methodology_agent", "synthesizer")
    graph.add_edge("coherence_agent", "synthesizer")
    graph.add_edge("citations_agent", "synthesizer")
    graph.add_edge("format_agent", "synthesizer")
    graph.add_edge("integrity_agent", "synthesizer")

    # Synthesizer -> END
    graph.add_edge("synthesizer", END)

    return graph


def compile_review_graph() -> CompiledStateGraph:
    """Compile and return the runnable review graph."""
    graph = build_review_graph()
    return graph.compile()
