import json
import logging
import uuid

from sqlalchemy import text
from sqlalchemy.engine import Engine

from src.application.llm_factory import LLMFactory
from src.application.pipelines.chunker import TextChunk

logger = logging.getLogger(__name__)

BATCH_SIZE = 50  # embeddings per API call


def embed_and_store(
    db_engine: Engine,
    chunks: list[TextChunk],
    layer: str,
    source_document: str,
    owner_id: str | None = None,
):
    """Generate embeddings for chunks and store them in pgvector."""
    if not chunks:
        logger.warning("No chunks to embed for %s", source_document)
        return

    embeddings_model = LLMFactory.create_embeddings()

    # Process in batches
    for batch_start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]
        texts = [c.content for c in batch]

        logger.info(
            "Embedding batch %d-%d of %d for %s",
            batch_start,
            batch_start + len(batch),
            len(chunks),
            source_document,
        )

        vectors = embeddings_model.embed_documents(texts)

        with db_engine.begin() as conn:
            for chunk, vector in zip(batch, vectors):
                conn.execute(
                    text("""
                        INSERT INTO knowledge_chunks (
                            id, layer, owner_id, source_document,
                            section_title, content, embedding,
                            chunk_index, metadata
                        ) VALUES (
                            :id::uuid, :layer::"KnowledgeLayer", :owner_id::uuid, :source_document,
                            :section_title, :content, :embedding::vector,
                            :chunk_index, :metadata::jsonb
                        )
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "layer": layer,
                        "owner_id": owner_id,
                        "source_document": source_document,
                        "section_title": chunk.section_title,
                        "content": chunk.content,
                        "embedding": str(vector),
                        "chunk_index": chunk.chunk_index,
                        "metadata": json.dumps(chunk.metadata, ensure_ascii=False),
                    },
                )

    logger.info(
        "Stored %d chunks for %s (%s)", len(chunks), source_document, layer
    )


def delete_by_source(db_engine: Engine, source_document: str):
    """Delete all chunks for a given source document."""
    with db_engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM knowledge_chunks WHERE source_document = :doc"),
            {"doc": source_document},
        )
        logger.info(
            "Deleted %d existing chunks for %s", result.rowcount, source_document
        )
