import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from src.application.llm_factory import LLMFactory
from src.domain.entities import ReviewState, FindingDict, RagChunkDict

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


class BaseAgent:
    """Base class for review agents."""

    agent_type: str = ""
    findings_key: str = ""

    def get_system_prompt(self, state: ReviewState) -> str:
        """Return the system prompt for this agent. Subclasses must implement."""
        raise NotImplementedError

    def get_user_prompt(self, state: ReviewState) -> str:
        """Return the user prompt for this agent. Subclasses must implement."""
        raise NotImplementedError

    def run(self, state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
        """Execute the agent and return updated state fields."""
        llm = LLMFactory.create_chat_model()
        system_prompt = self.get_system_prompt(state)
        user_prompt = self.get_user_prompt(state)

        rag_context = state.get("rag_context", [])
        if rag_context:
            context_text = self._format_rag_context(rag_context)
            user_prompt = f"{context_text}\n\n---\n\n{user_prompt}"
        else:
            user_prompt = (
                "(No se encontraron referencias en la base de conocimiento. "
                "Procede con tu evaluacion basandote en tu conocimiento general "
                "sobre normas academicas de la UPB.)\n\n"
                + user_prompt
            )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = llm.invoke(messages)
                findings = self._parse_response(response.content)
                return {self.findings_key: findings}
            except Exception as e:
                last_error = e
                logger.warning(
                    "Agent %s attempt %d failed: %s",
                    self.agent_type, attempt + 1, str(e),
                )

        logger.error("Agent %s failed after %d retries", self.agent_type, MAX_RETRIES)
        return {
            self.findings_key: [],
            "agent_errors": {self.agent_type: str(last_error)},
        }

    @staticmethod
    def _format_rag_context(chunks: list[RagChunkDict]) -> str:
        lines = [
            "## Base de Conocimiento Relevante\n",
            "Las siguientes referencias fundamentan tu evaluacion:\n",
        ]
        for i, chunk in enumerate(chunks, 1):
            section = chunk.get("metadata", {}).get("section", "General")
            lines.append(
                f'[{i}] ({chunk["layer"]} - {chunk["document_title"]}, '
                f'Seccion: {section})\n"{chunk["content"]}"\n'
            )
        lines.append(
            "Cada observacion que generes DEBE referenciar al menos una de estas fuentes."
        )
        return "\n".join(lines)

    def _parse_response(self, content: str) -> list[FindingDict]:
        """Parse the LLM response as a JSON array of observations."""
        # Strip markdown code fences if present
        text = content.strip()
        if text.startswith("```"):
            first_newline = text.index("\n")
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

        parsed = json.loads(text)
        if isinstance(parsed, dict) and "observations" in parsed:
            parsed = parsed["observations"]
        if not isinstance(parsed, list):
            parsed = [parsed]
        return parsed
