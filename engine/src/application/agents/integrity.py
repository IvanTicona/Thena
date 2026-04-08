from src.application.agents.base import BaseAgent
from src.domain.entities import ReviewState


class IntegrityAgent(BaseAgent):
    """Academic integrity pattern detector for UPB thesis projects.

    Detects suspicious patterns that may indicate academic integrity concerns:
    overly similar paragraphs, circular reasoning, unsupported claims,
    and structural anomalies.

    IMPORTANT: This agent NEVER assigns ERROR severity. AI cannot prove
    plagiarism — it can only flag suspicious patterns for human review.

    Severity mapping:
    - Suspicious structural/rhetorical pattern → WARNING
    - Potential unsupported claim or circular reasoning → WARNING
    - Minor style anomaly worth noting → SUGGESTION
    """

    agent_type = "INTEGRITY"
    findings_key = "integrity_findings"

    def get_system_prompt(self, state: ReviewState) -> str:
        chapter_title = state.get("chapter_title", "")
        return f"""Eres un agente especializado en deteccion de patrones de integridad academica en Proyectos de Grado de la UPB.

Tu tarea es identificar patrones SOSPECHOSOS en el capitulo "{chapter_title}" que podrian indicar problemas de integridad academica.

PATRONES A DETECTAR:
1. Parrafos muy similares entre si dentro del mismo capitulo (posible redundancia o copia interna).
2. Razonamiento circular (conclusion que repite la premisa sin argumentacion).
3. Afirmaciones sin respaldo bibliografico que presentan hechos como evidentes.
4. Cambios abruptos de estilo o voz narrativa que sugieren origen heterogeneo del texto.
5. Uso excesivo de citas directas sin elaboracion propia del estudiante.
6. Afirmaciones absolutas ("siempre", "nunca", "todos") sin evidencia.

REGLAS CRITICAS:
- JAMAS uses severidad ERROR — este agente NO puede probar plagio.
- Solo usa WARNING para patrones claramente sospechosos.
- Solo usa SUGGESTION para anomalias menores que merecen atencion.
- Formula las observaciones como preguntas orientadoras, NO acusaciones.
- Respeta la presuncion de buena fe del estudiante.
- Responde en espanol.

FORMATO DE SALIDA: Responde UNICAMENTE con un JSON array de observaciones con este esquema:
[
  {{
    "type": "INTEGRITY",
    "severity": "WARNING | SUGGESTION | INFO",
    "message": "Pregunta orientadora sobre el patron detectado",
    "suggestion": "Como el estudiante puede abordar la observacion (opcional, puede ser null)",
    "textFragment": "Fragmento sospechoso del documento (opcional, puede ser null)",
    "offsetStart": null,
    "offsetEnd": null,
    "sourceReference": null
  }}
]

Si no detectas ningun patron sospechoso, devuelve un array vacio: []"""

    def get_user_prompt(self, state: ReviewState) -> str:
        chapter_number = state.get("chapter_number", 0)
        chapter_title = state.get("chapter_title", "")
        document_text = state.get("document_text", "")

        return f"""Capitulo {chapter_number}: {chapter_title}

Texto del capitulo:
{document_text}

Analiza este capitulo en busca de patrones sospechosos de integridad academica.
Recuerda: formula observaciones como preguntas orientadoras, no como acusaciones.
Si el capitulo no presenta patrones sospechosos, devuelve un array vacio."""
