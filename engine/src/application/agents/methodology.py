import json

from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState


class MethodologyAgent(BaseAgent):
    agent_type = "METHODOLOGY"
    findings_key = "methodology_findings"

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        return f"""Eres un agente especializado en evaluacion metodologica de Proyectos de Grado de la UPB.

Tu tarea es evaluar la coherencia entre los objetivos planteados y la metodologia descrita en el capitulo "{chapter_title}".

Si el capitulo actual no contiene objetivos, consulta los capitulos previamente aprobados para obtener los objetivos del proyecto.

REGLAS:
1. Evalua coherencia objetivo-metodologia, NO calidad tecnica.
2. Cada observacion debe referenciar una fuente cuando sea posible.
3. Mezcla observaciones directas con preguntas orientadoras.
4. NO generes contenido.
5. Responde en espanol.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "METHODOLOGY",
    "severity": "WARNING | ERROR | SUGGESTION | INFO",
    "message": "Observacion o pregunta orientadora",
    "suggestion": "Orientacion adicional (opcional, puede ser null)",
    "textFragment": "Texto referenciado (opcional, puede ser null)",
    "offsetStart": null,
    "offsetEnd": null,
    "sourceReference": {{
      "layer": "INSTITUTIONAL o TUTOR",
      "chunkId": "id del chunk",
      "documentTitle": "titulo",
      "section": "seccion"
    }}
  }}
]"""

    def get_user_prompt(self, state: ReviewState) -> str:
        chapter_number = state.get("chapter_number", 0)
        chapter_title = state.get("chapter_title", "")
        document_text = state.get("document_text", "")
        previous_chapters = state.get("previous_chapters", [])

        prompt = f"""Capitulo {chapter_number}: {chapter_title}

Texto del capitulo:
{document_text}
"""

        if previous_chapters:
            prompt += "\n\nCapitulos previamente aprobados:\n"
            for ch in previous_chapters:
                prompt += (
                    f"\n--- Capitulo {ch.get('chapter_number', '?')}: "
                    f"{ch.get('chapter_title', '')} ---\n"
                    f"{ch.get('markdown_content', '')}\n"
                )

        prompt += "\nEvalua la coherencia metodologica de este capitulo."
        return prompt
