import logging

from langgraph.graph import StateGraph, START, END

from src.domain.entities import ReviewState
from src.application.agents.structure import StructureAgent
from src.application.agents.methodology import MethodologyAgent
from src.application.agents.coherence import CoherenceAgent
from src.application.agents.synthesizer import synthesize

logger = logging.getLogger(__name__)

_structure_agent = StructureAgent()
_methodology_agent = MethodologyAgent()
_coherence_agent = CoherenceAgent()


def run_structure(state: ReviewState) -> dict:
    logger.info("Running Structure Agent for submission %s", state.get("submission_id"))
    return _structure_agent.run(state)


def run_methodology(state: ReviewState) -> dict:
    logger.info("Running Methodology Agent for submission %s", state.get("submission_id"))
    return _methodology_agent.run(state)


def run_coherence(state: ReviewState) -> dict:
    logger.info("Running Coherence Agent for submission %s", state.get("submission_id"))
    return _coherence_agent.run(state)


def run_synthesizer(state: ReviewState) -> dict:
    logger.info("Running Synthesizer for submission %s", state.get("submission_id"))
    return synthesize(state)


def build_review_graph() -> StateGraph:
    """Build the LangGraph review workflow with 3 parallel agents + synthesizer."""
    graph = StateGraph(ReviewState)

    # Add nodes
    graph.add_node("structure_agent", run_structure)
    graph.add_node("methodology_agent", run_methodology)
    graph.add_node("coherence_agent", run_coherence)
    graph.add_node("synthesizer", run_synthesizer)

    # Fan-out: START -> all 3 agents in parallel
    graph.add_edge(START, "structure_agent")
    graph.add_edge(START, "methodology_agent")
    graph.add_edge(START, "coherence_agent")

    # Fan-in: all 3 agents -> synthesizer
    graph.add_edge("structure_agent", "synthesizer")
    graph.add_edge("methodology_agent", "synthesizer")
    graph.add_edge("coherence_agent", "synthesizer")

    # Synthesizer -> END
    graph.add_edge("synthesizer", END)

    return graph


def compile_review_graph():
    """Compile and return the runnable review graph."""
    graph = build_review_graph()
    return graph.compile()
