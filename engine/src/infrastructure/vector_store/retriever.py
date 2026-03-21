import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from src.config import settings
from src.application.llm_factory import LLMFactory
from src.domain.entities import RagChunkDict

logger = logging.getLogger(__name__)


class RAGRetriever:
    def __init__(self, db_engine: Engine) -> None:
        self._db_engine = db_engine
        self._embeddings = LLMFactory.create_embeddings()

    def retrieve(
        self, query: str, tutor_id: str | None = None
    ) -> list[RagChunkDict]:
        """Retrieve relevant knowledge chunks from pgvector."""
        query_embedding = self._embeddings.embed_query(query)

        top_k = settings.RAG_TOP_K
        threshold = settings.RAG_SIMILARITY_THRESHOLD
        tutor_weight = settings.RAG_TUTOR_WEIGHT

        with self._db_engine.connect() as conn:
            result = conn.execute(
                text("""
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
                        (kc.layer = 'INSTITUTIONAL' OR (kc.layer = 'TUTOR' AND kc.owner_id = CAST(:tutor_id AS uuid)))
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
                        "section": row.section_title or metadata.get("section", "General"),
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
                f'[{i}] ({chunk["layer"]} - {chunk["document_title"]}, Seccion: {section})\n'
                f'"{chunk["content"]}"\n'
            )

        lines.append(
            "Cada observacion que generes DEBE referenciar al menos una de estas fuentes."
        )

        return "\n".join(lines)
