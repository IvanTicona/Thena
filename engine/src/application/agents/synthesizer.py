import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from src.application.llm_factory import LLMFactory
from src.domain.entities import ReviewState, FindingDict

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el sintetizador pedagogico del sistema Thena. Recibes las observaciones de multiples agentes especializados y debes:

1. Consolidar observaciones eliminando duplicados (observaciones sobre el mismo fragmento de texto con el mismo mensaje).
2. Generar un RESUMEN EJECUTIVO (3-5 parrafos) que:
   - Destaque las fortalezas del capitulo
   - Identifique las areas principales de mejora
   - Ofrezca orientacion general sobre los proximos pasos
3. Mantener un tono pedagogico: firme pero orientador.
4. NO generar contenido en lugar del estudiante.
5. Todo en espanol.

IMPORTANTE: Toda retroalimentacion es ORIENTACION PRELIMINAR, no una correccion definitiva ni una calificacion.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON con este esquema:
{
  "summary": "Resumen ejecutivo en texto plano",
  "observations": [/* observaciones consolidadas, ordenadas por offsetStart */],
  "totalObservations": 12,
  "bySeverity": { "INFO": 3, "SUGGESTION": 5, "WARNING": 3, "ERROR": 1 }
}"""


def synthesize(state: ReviewState) -> dict[str, str | list[FindingDict]]:
    """Consolidate findings from all agents into a unified report."""
    structure = state.get("structure_findings", [])
    methodology = state.get("methodology_findings", [])
    coherence = state.get("coherence_findings", [])
    agent_errors = state.get("agent_errors", {})

    all_findings = []
    for findings in [structure, methodology, coherence]:
        if isinstance(findings, list):
            all_findings.extend(findings)

    # If no findings at all, produce a minimal report
    if not all_findings:
        error_note = ""
        if agent_errors:
            failed = ", ".join(agent_errors.keys())
            error_note = f" Los siguientes agentes no pudieron completar su analisis: {failed}."

        return {
            "summary": (
                "No se generaron observaciones para este capitulo."
                + error_note
            ),
            "observations": [],
        }

    llm = LLMFactory.create_chat_model()

    error_context = ""
    if agent_errors:
        failed = ", ".join(agent_errors.keys())
        error_context = (
            f"\n\nNOTA: Los siguientes agentes fallaron: {failed}. "
            "Adapta tu sintesis a los resultados disponibles."
        )

    user_prompt = f"""Observaciones de los agentes especializados:

{json.dumps(all_findings, ensure_ascii=False, indent=2)}
{error_context}

Consolida estas observaciones en un reporte unificado."""

    try:
        response = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ])

        text = response.content.strip()
        if text.startswith("```"):
            first_newline = text.index("\n")
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

        result = json.loads(text)
        return {
            "summary": result.get("summary", ""),
            "observations": result.get("observations", all_findings),
        }
    except Exception as e:
        logger.error("Synthesizer failed: %s", str(e))
        # Fallback: return raw merged findings
        return {
            "summary": (
                "El sintetizador no pudo generar un resumen consolidado. "
                "Se presentan las observaciones individuales de cada agente."
            ),
            "observations": all_findings,
        }
