import json

from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState


class StructureAgent(BaseAgent):
    agent_type = "STRUCTURE"
    findings_key = "structure_findings"

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        return f"""Eres un agente especializado en validacion de estructura de documentos academicos de Proyecto de Grado de la UPB.

Tu tarea es evaluar si la estructura del capitulo "{chapter_title}" cumple con los lineamientos de la base de conocimiento.

REGLAS:
1. Solo evaluas estructura, NO contenido ni redaccion.
2. Cada observacion debe referenciar una fuente de la base de conocimiento cuando sea posible.
3. Formula observaciones como orientacion pedagogica:
   - Observaciones directas para errores claros
   - Preguntas guia para areas de mejora
4. NO generes contenido para el estudiante.
5. Responde en espanol.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "STRUCTURE",
    "severity": "WARNING | ERROR | SUGGESTION | INFO",
    "message": "Observacion directa o pregunta guia",
    "suggestion": "Orientacion adicional (opcional, puede ser null)",
    "textFragment": "Texto referenciado del documento (opcional, puede ser null)",
    "offsetStart": null,
    "offsetEnd": null,
    "sourceReference": {{
      "layer": "INSTITUTIONAL o TUTOR",
      "chunkId": "id del chunk referenciado",
      "documentTitle": "titulo del documento",
      "section": "seccion del documento"
    }}
  }}
]"""

    def get_user_prompt(self, state: ReviewState) -> str:
        sections = state.get("document_sections", [])
        chapter_number = state.get("chapter_number", 0)
        chapter_title = state.get("chapter_title", "")

        sections_text = json.dumps(sections, ensure_ascii=False, indent=2)

        return f"""Capitulo {chapter_number}: {chapter_title}

Secciones del documento:
{sections_text}

Evalua la estructura de este capitulo segun los lineamientos de la base de conocimiento."""
