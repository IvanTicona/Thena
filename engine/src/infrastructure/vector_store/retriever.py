import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from src.config import settings
from src.application.llm_factory import LLMFactory
from src.domain.entities import RagChunkDict
from src.domain.ports import RAGRetrieverPort

logger = logging.getLogger(__name__)


class RAGRetriever(RAGRetrieverPort):
    def __init__(self, db_engine: Engine) -> None:
        self._db_engine = db_engine
        self._embeddings = LLMFactory.create_embeddings()

    def retrieve(
        self, query: str, tutor_id: str | None = None, layers: list[str] | None = None
    ) -> list[RagChunkDict]:
        """Retrieve relevant knowledge chunks from pgvector.

        Args:
            query: The search query string.
            tutor_id: Optional tutor UUID to include TUTOR-layer chunks.
            layers: Optional explicit list of KnowledgeLayer values to query.
                    Defaults to ['INSTITUTIONAL', 'TUTOR'] (tutor only when
                    tutor_id is provided). Use ['BIBLIOGRAPHY'] for citation checks.
        """
        query_embedding = self._embeddings.embed_query(query)

        top_k = settings.RAG_TOP_K
        threshold = settings.RAG_SIMILARITY_THRESHOLD
        tutor_weight = settings.RAG_TUTOR_WEIGHT

        # Build the layer filter clause based on requested layers.
        # Default behaviour (layers=None): INSTITUTIONAL always included,
        # TUTOR only when tutor_id is provided.
        if layers is not None:
            # Caller specified explicit layers — build a simple IN-clause.
            # TUTOR layer still requires tutor_id; skip it silently if absent.
            active_layers = [
                lyr for lyr in layers if lyr != "TUTOR" or tutor_id is not None
            ]
            if not active_layers:
                logger.warning(
                    "retrieve() called with layers=%s but no valid layers remain",
                    layers,
                )
                return []
            layer_filter = " OR ".join(f"kc.layer = '{lyr}'" for lyr in active_layers)
            if "TUTOR" in active_layers:
                # Replace generic TUTOR clause with owner-scoped one
                layer_filter = " OR ".join(
                    f"kc.layer = '{lyr}'"
                    if lyr != "TUTOR"
                    else f"(kc.layer = 'TUTOR' AND kc.owner_id = CAST(:tutor_id AS uuid))"
                    for lyr in active_layers
                )
        else:
            # Default: INSTITUTIONAL + TUTOR (only if tutor_id is present)
            layer_filter = (
                "(kc.layer = 'INSTITUTIONAL' OR "
                "(kc.layer = 'TUTOR' AND kc.owner_id = CAST(:tutor_id AS uuid)))"
            )

        with self._db_engine.connect() as conn:
            result = conn.execute(
                text(f"""
                    SELECT
                        kc.id,
                        kc.content,
                        kc.metadata,
                        kc.source_document,
                        kc.section_title,
                        CAST(kc.layer AS text) AS layer,
                        (kc.embedding <=> CAST(:embedding AS vector)) AS distance,
                        CASE
                            WHEN kc.layer = 'TUTOR' THEN (1 - (kc.embedding <=> CAST(:embedding AS vector))) * :tutor_weight
                            ELSE 1 - (kc.embedding <=> CAST(:embedding AS vector))
                        END AS weighted_similarity
                    FROM knowledge_chunks kc
                    WHERE
                        ({layer_filter})
                        AND (1 - (kc.embedding <=> CAST(:embedding AS vector))) >= :threshold
                    ORDER BY weighted_similarity DESC
                    LIMIT :top_k
                """),
                {
                    "embedding": str(query_embedding),
                    "tutor_id": tutor_id,
                    "threshold": threshold,
                    "tutor_weight": tutor_weight,
                    "top_k": top_k,
                },
            )

            chunks = []
            for row in result:
                metadata = row.metadata if isinstance(row.metadata, dict) else {}
                chunks.append(
                    {
                        "chunk_id": str(row.id),
                        "content": row.content,
                        "metadata": metadata,
                        "document_title": row.source_document,
                        "layer": row.layer,
                        "section": row.section_title
                        or metadata.get("section", "General"),
                        "similarity": float(1 - row.distance),
                    }
                )

            logger.info("Retrieved %d chunks (threshold=%.2f)", len(chunks), threshold)
            return chunks

    def format_context(self, chunks: list[RagChunkDict]) -> str:
        """Format retrieved chunks as numbered references for LLM prompts."""
        if not chunks:
            return ""

        lines = [
            "## Base de Conocimiento Relevante\n",
            "Las siguientes referencias fundamentan tu evaluacion:\n",
        ]

        for i, chunk in enumerate(chunks, 1):
            section = chunk.get("section", "General")
            lines.append(
                f"[{i}] ({chunk['layer']} - {chunk['document_title']}, Seccion: {section})\n"
                f'"{chunk["content"]}"\n'
            )

        lines.append(
            "Cada observacion que generes DEBE referenciar al menos una de estas fuentes."
        )

        return "\n".join(lines)
