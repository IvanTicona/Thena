"""
Tests for RAG retrieval pipeline (engine/src/infrastructure/vector_store/retriever.py).

All DB calls and embedding calls are mocked — no real PostgreSQL or embedding API needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from src.infrastructure.vector_store.retriever import RAGRetriever


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_db_row(
    id_="chunk-1",
    content="Contenido de prueba.",
    metadata=None,
    source_document="Guia UPB",
    section_title="Estructura",
    layer="INSTITUTIONAL",
    distance=0.15,
):
    row = MagicMock()
    row.id = id_
    row.content = content
    row.metadata = metadata or {}
    row.source_document = source_document
    row.section_title = section_title
    row.layer = layer
    row.distance = distance
    return row


def make_retriever() -> tuple[RAGRetriever, MagicMock, MagicMock]:
    """Return (retriever, mock_db_engine, mock_embeddings)."""
    mock_engine = MagicMock()
    mock_embeddings = MagicMock()
    mock_embeddings.embed_query.return_value = [0.1] * 1536

    with patch(
        "src.infrastructure.vector_store.retriever.LLMFactory.create_embeddings",
        return_value=mock_embeddings,
    ):
        retriever = RAGRetriever(db_engine=mock_engine)

    return retriever, mock_engine, mock_embeddings


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------


class TestRAGRetrieverInit:
    def test_creates_embeddings_on_init(self):
        mock_engine = MagicMock()
        mock_embeddings = MagicMock()
        with patch(
            "src.infrastructure.vector_store.retriever.LLMFactory.create_embeddings",
            return_value=mock_embeddings,
        ) as factory_mock:
            retriever = RAGRetriever(db_engine=mock_engine)

        factory_mock.assert_called_once()

    def test_stores_db_engine(self):
        mock_engine = MagicMock()
        with patch(
            "src.infrastructure.vector_store.retriever.LLMFactory.create_embeddings"
        ):
            retriever = RAGRetriever(db_engine=mock_engine)

        assert retriever._db_engine is mock_engine


# ---------------------------------------------------------------------------
# retrieve() — happy path
# ---------------------------------------------------------------------------


class TestRAGRetrieverRetrieve:
    def test_retrieve_returns_list(self):
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = [make_db_row()]

        result = retriever.retrieve("estructura del capitulo")

        assert isinstance(result, list)

    def test_retrieve_maps_row_to_rag_chunk_dict(self):
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = [
            make_db_row(
                id_="abc",
                content="Contenido.",
                source_document="Guia",
                section_title="Estructura",
                layer="INSTITUTIONAL",
                distance=0.1,
            )
        ]

        result = retriever.retrieve("query")

        assert len(result) == 1
        chunk = result[0]
        assert chunk["chunk_id"] == "abc"
        assert chunk["content"] == "Contenido."
        assert chunk["document_title"] == "Guia"
        assert chunk["layer"] == "INSTITUTIONAL"
        assert "similarity" in chunk
        assert isinstance(chunk["similarity"], float)

    def test_similarity_calculated_from_distance(self):
        """similarity = 1 - distance"""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = [make_db_row(distance=0.2)]

        result = retriever.retrieve("query")

        assert abs(result[0]["similarity"] - 0.8) < 0.001

    def test_retrieve_calls_embed_query(self):
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = []

        retriever.retrieve("estructura del capitulo")

        mock_embeddings.embed_query.assert_called_once_with("estructura del capitulo")

    def test_empty_result_returns_empty_list(self):
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = []

        result = retriever.retrieve("query with no results")

        assert result == []

    def test_section_falls_back_to_metadata_section(self):
        """If section_title is None, fall back to metadata['section']."""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        row = make_db_row(section_title=None, metadata={"section": "Metodologia"})
        mock_conn.execute.return_value = [row]

        result = retriever.retrieve("query")

        assert result[0]["section"] == "Metodologia"

    def test_section_falls_back_to_general(self):
        """If both section_title and metadata['section'] are None, use 'General'."""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        row = make_db_row(section_title=None, metadata={})
        mock_conn.execute.return_value = [row]

        result = retriever.retrieve("query")

        assert result[0]["section"] == "General"

    def test_metadata_non_dict_treated_as_empty(self):
        """If row.metadata is not a dict (e.g. None), treat as {}."""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        row = make_db_row(metadata=None, section_title="S")
        mock_conn.execute.return_value = [row]

        result = retriever.retrieve("query")

        assert result[0]["metadata"] == {}


# ---------------------------------------------------------------------------
# retrieve() — layers parameter
# ---------------------------------------------------------------------------


class TestRAGRetrieverLayers:
    def test_bibliography_layer_explicit(self):
        """Calling with layers=['BIBLIOGRAPHY'] should NOT raise and returns results."""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = [make_db_row(layer="BIBLIOGRAPHY")]

        result = retriever.retrieve("citas", layers=["BIBLIOGRAPHY"])

        assert len(result) == 1
        assert result[0]["layer"] == "BIBLIOGRAPHY"

    def test_tutor_layer_without_tutor_id_skipped(self):
        """TUTOR layer requested but tutor_id=None → should return [] gracefully."""
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = []

        result = retriever.retrieve("query", tutor_id=None, layers=["TUTOR"])

        assert result == []

    def test_tutor_layer_with_tutor_id_included(self):
        retriever, mock_engine, mock_embeddings = make_retriever()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value = [make_db_row(layer="TUTOR")]

        result = retriever.retrieve(
            "query", tutor_id="tutor-uuid-123", layers=["TUTOR"]
        )

        assert len(result) == 1


# ---------------------------------------------------------------------------
# format_context()
# ---------------------------------------------------------------------------


class TestRAGRetrieverFormatContext:
    def setup_method(self):
        self.retriever, _, _ = make_retriever()

    def test_empty_chunks_returns_empty_string(self):
        result = self.retriever.format_context([])
        assert result == ""

    def test_non_empty_chunks_returns_numbered_list(self):
        chunks = [
            {
                "chunk_id": "c1",
                "content": "Texto de prueba.",
                "document_title": "Guia UPB",
                "layer": "INSTITUTIONAL",
                "section": "Estructura",
                "metadata": {},
                "similarity": 0.9,
            }
        ]
        result = self.retriever.format_context(chunks)
        assert "[1]" in result
        assert "Texto de prueba." in result
        assert "Guia UPB" in result

    def test_format_includes_source_instruction(self):
        chunks = [
            {
                "chunk_id": "c1",
                "content": "Texto.",
                "document_title": "Doc",
                "layer": "INSTITUTIONAL",
                "section": "S",
                "metadata": {},
                "similarity": 0.8,
            }
        ]
        result = self.retriever.format_context(chunks)
        assert "referenciar" in result or "fuentes" in result
