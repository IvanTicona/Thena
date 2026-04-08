from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState


class FormatAgent(BaseAgent):
    """Document formatting checker for UPB thesis projects.

    Evaluates document formatting against UPB institutional guidelines,
    including font consistency, margins, spacing, heading styles,
    page numbers, and table of contents structure.

    Severity mapping:
    - Wrong font or margins (clear institutional requirement violation) → WARNING
    - Minor inconsistency (e.g., heading capitalization, spacing) → SUGGESTION
    """

    agent_type = "FORMAT"
    findings_key = "format_findings"

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        return f"""Eres un agente especializado en formato de documentos academicos de Proyecto de Grado de la UPB.

Tu tarea es evaluar el formato del capitulo "{chapter_title}" segun los lineamientos institucionales de la UPB.

CRITERIOS DE EVALUACION:
1. Consistencia tipografica (fuentes, tamanos, estilos).
2. Estructura de titulos y subtitulos (jerarquia, numeracion, estilo).
3. Espaciado entre parrafos y lineas (interlineado).
4. Presentacion de tablas y figuras (titulo, numeracion, fuente).
5. Uso correcto de sangrias y margenes.
6. Coherencia en la numeracion de secciones.
7. Presencia y formato de pie de pagina o numeracion de paginas cuando aplica.

REGLAS DE SEVERIDAD:
- Incumplimiento claro de requisito institucional (fuente, margenes, interlineado) → WARNING
- Inconsistencia menor de estilo (mayusculas en titulos, espaciado variable) → SUGGESTION
- NO uses ERROR para problemas de formato — solo para agentes de contenido.

IMPORTANTE:
- Evalua formato, NO contenido ni argumentacion.
- Si no puedes inferir datos de formato del texto (ej. margenes exactos), NO los evalues.
- Responde en espanol con orientacion pedagogica.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "FORMAT",
    "severity": "WARNING | SUGGESTION | INFO",
    "message": "Observacion directa o pregunta orientadora",
    "suggestion": "Orientacion adicional (opcional, puede ser null)",
    "textFragment": "Texto referenciado del documento (opcional, puede ser null)",
    "offsetStart": null,
    "offsetEnd": null,
    "sourceReference": {{
      "layer": "INSTITUTIONAL",
      "chunkId": "id del chunk referenciado",
      "documentTitle": "titulo del documento",
      "section": "seccion del documento"
    }}
  }}
]"""

    def get_user_prompt(self, state: ReviewState) -> str:
        import json

        chapter_number = state.get("chapter_number", 0)
        chapter_title = state.get("chapter_title", "")
        document_sections = state.get("document_sections", [])
        document_text = state.get("document_text", "")

        sections_json = json.dumps(document_sections, ensure_ascii=False, indent=2)

        return f"""Capitulo {chapter_number}: {chapter_title}

Estructura de secciones del documento (con niveles de heading):
{sections_json}

Texto completo del capitulo:
{document_text}

Evalua el formato de este capitulo segun los lineamientos institucionales de la UPB.
Enfocate en: jerarquia de titulos, consistencia tipografica, espaciado, presentacion de tablas y figuras."""
