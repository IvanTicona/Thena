from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState, FindingDict


class CitationsAgent(BaseAgent):
    """APA 7th edition citation checker.

    Cross-references the BIBLIOGRAPHY RAG layer to verify that in-text
    citations match the reference list and follow APA 7 formatting rules.

    Severity mapping:
    - Missing citation for a claim → ERROR
    - APA 7 format violation → WARNING
    - Minor style inconsistency → SUGGESTION
    """

    agent_type = "CITATIONS"
    findings_key = "citations_findings"

    def run(self, state: ReviewState) -> dict[str, list[FindingDict] | dict[str, str]]:
        """Override base run() to use bibliography_context as the RAG source.

        The base class reads state["rag_context"] to build the knowledge-base
        section of the prompt. For citation checking we want BIBLIOGRAPHY chunks
        instead of INSTITUTIONAL/TUTOR chunks, so we temporarily expose
        bibliography_context under the rag_context key.
        """
        bibliography_ctx = state.get("bibliography_context", [])
        # Build a shallow copy of the state with bibliography_context as rag_context.
        # This avoids mutating the shared LangGraph state dict.
        augmented_state: ReviewState = {**state, "rag_context": bibliography_ctx}  # type: ignore[typeddict-item]
        return super().run(augmented_state)

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        return f"""Eres un agente especializado en revision de citas y referencias bibliograficas de Proyectos de Grado de la UPB.

Tu tarea es evaluar el capitulo "{chapter_title}" para verificar el cumplimiento de las normas APA 7ma edicion.

Recibiras referencias de la capa bibliografica (BIBLIOGRAPHY) de la base de conocimiento.
Cruza esas referencias con las citas en el texto y la lista de referencias del documento.

CRITERIOS DE EVALUACION:
1. Toda afirmacion factual o idea tomada de otra fuente DEBE tener una cita en texto.
2. Toda cita en texto DEBE aparecer en la lista de referencias, y viceversa.
3. Las citas en texto deben seguir formato APA 7: (Autor, Anio) o Autor (Anio).
4. Las entradas de la lista de referencias deben seguir el formato APA 7 segun el tipo de fuente.
5. Los DOI y URL deben presentarse como hipervinculos cuando esten disponibles.
6. Autores con el mismo apellido requieren iniciales para diferenciarlos.

REGLAS DE SEVERIDAD:
- Afirmacion sin cita que claramente la requiere → ERROR
- Incumplimiento de formato APA 7 en cita o entrada de referencias → WARNING
- Inconsistencia menor de estilo (ej. espaciado, "&" vs "y") → SUGGESTION

IMPORTANTE:
- Solo marca problemas que puedas identificar claramente en el texto.
- No inventes citas faltantes — marcalas como posibles problemas.
- Responde en espanol con orientacion pedagogica (preguntas guia para casos dudosos).

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "CITATIONS",
    "severity": "WARNING | ERROR | SUGGESTION | INFO",
    "message": "Observacion directa o pregunta orientadora",
    "suggestion": "Orientacion adicional (opcional, puede ser null)",
    "textFragment": "Texto referenciado del documento (opcional, puede ser null)",
    "offsetStart": null,
    "offsetEnd": null,
    "sourceReference": {{
      "layer": "BIBLIOGRAPHY",
      "chunkId": "id del chunk referenciado",
      "documentTitle": "titulo del documento",
      "section": "seccion del documento"
    }}
  }}
]"""

    def get_user_prompt(self, state: ReviewState) -> str:
        chapter_number = state.get("chapter_number", 0)
        chapter_title = state.get("chapter_title", "")
        document_text = state.get("document_text", "")

        return f"""Capitulo {chapter_number}: {chapter_title}

Texto del capitulo:
{document_text}

Evalua el cumplimiento de las normas APA 7ma edicion en las citas y referencias bibliograficas de este capitulo.
Identifica: citas sin referencia, referencias sin cita, errores de formato APA 7, y afirmaciones sin respaldo bibliografico."""
