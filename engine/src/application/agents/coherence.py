from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState


class CoherenceAgent(BaseAgent):
    agent_type = "COHERENCE"
    findings_key = "coherence_findings"

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        previous_chapters = state.get("previous_chapters", [])

        approved_list = ""
        if previous_chapters:
            titles = [
                f"  - Capitulo {ch.get('chapter_number', '?')}: {ch.get('chapter_title', '')}"
                for ch in previous_chapters
            ]
            approved_list = "\n".join(titles)

        return f"""Eres un agente especializado en evaluacion de coherencia logica y argumentativa de Proyectos de Grado de la UPB.

Tu tarea es evaluar la coherencia del capitulo "{chapter_title}" en dos niveles:

1. INTRA-CAPITULO: coherencia interna entre secciones del capitulo.
2. INTER-CAPITULO: coherencia con los capitulos previamente aprobados:
{approved_list if approved_list else "  (No hay capitulos previos aprobados)"}

REGLAS:
1. Evalua coherencia logica, NO formato ni estructura.
2. Identifica contradicciones, inconsistencias y saltos logicos.
3. Verifica que las afirmaciones estan respaldadas.
4. Cada observacion debe referenciar una fuente cuando aplique.
5. Mezcla observaciones directas con preguntas guia.
6. NO generes contenido.
7. Responde en espanol.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "COHERENCE",
    "severity": "WARNING | ERROR | SUGGESTION | INFO",
    "message": "Observacion o pregunta guia",
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

        prompt += "\nEvalua la coherencia logica y argumentativa de este capitulo."
        return prompt
