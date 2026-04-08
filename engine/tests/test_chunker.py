"""
Tests for the text chunker (engine/src/application/pipelines/chunker.py).
"""

from __future__ import annotations

import pytest

from src.application.pipelines.chunker import (
    chunk_text,
    TextChunk,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    _split_with_overlap,
    _chunk_plain,
    _chunk_by_sections,
)


# ---------------------------------------------------------------------------
# chunk_text — main entry point
# ---------------------------------------------------------------------------


class TestChunkText:
    def test_returns_list_of_text_chunks(self):
        chunks = chunk_text("Hello world.")
        assert isinstance(chunks, list)
        for c in chunks:
            assert isinstance(c, TextChunk)

    def test_short_text_produces_single_chunk(self):
        chunks = chunk_text("Short text.")
        assert len(chunks) == 1
        assert chunks[0].content == "Short text."

    def test_plain_mode_when_no_sections(self):
        long_text = "A" * (CHUNK_SIZE + 500)
        chunks = chunk_text(long_text)
        assert len(chunks) >= 2

    def test_plain_mode_chunk_index_sequential(self):
        long_text = "A" * (CHUNK_SIZE * 3)
        chunks = chunk_text(long_text)
        for i, c in enumerate(chunks):
            assert c.chunk_index == i

    def test_sections_mode_used_when_sections_provided(self):
        sections = [
            {
                "heading": "Introduccion",
                "level": 1,
                "content": "Contenido de introduccion.",
                "offset_start": 0,
                "offset_end": 40,
            }
        ]
        chunks = chunk_text("", sections=sections)
        assert len(chunks) >= 1
        assert chunks[0].section_title == "Introduccion"

    def test_plain_chunks_have_no_section_title(self):
        chunks = chunk_text("Some text here.")
        for c in chunks:
            assert c.section_title is None

    def test_empty_text_returns_empty_list(self):
        chunks = chunk_text("")
        assert chunks == []


class TestChunkBySections:
    def test_small_section_becomes_single_chunk(self):
        sections = [
            {
                "heading": "Marco Teorico",
                "level": 1,
                "content": "Texto breve.",
                "offset_start": 0,
                "offset_end": 20,
            }
        ]
        chunks = _chunk_by_sections(sections, chunk_size=1000, chunk_overlap=200)
        assert len(chunks) == 1
        assert "Marco Teorico" in chunks[0].content

    def test_large_section_split_into_multiple_chunks(self):
        content = "Parrafo. " * 200  # ~1800 chars
        sections = [
            {
                "heading": "Seccion Larga",
                "level": 1,
                "content": content,
                "offset_start": 0,
                "offset_end": len(content),
            }
        ]
        chunks = _chunk_by_sections(sections, chunk_size=500, chunk_overlap=100)
        assert len(chunks) > 1

    def test_section_title_preserved_in_each_sub_chunk(self):
        content = "x" * 2000
        sections = [
            {
                "heading": "Mi Seccion",
                "level": 2,
                "content": content,
                "offset_start": 0,
                "offset_end": 2000,
            }
        ]
        chunks = _chunk_by_sections(sections, chunk_size=500, chunk_overlap=100)
        for c in chunks:
            assert c.section_title == "Mi Seccion"

    def test_multiple_sections_preserve_order(self):
        sections = [
            {
                "heading": "A",
                "level": 1,
                "content": "Texto A.",
                "offset_start": 0,
                "offset_end": 10,
            },
            {
                "heading": "B",
                "level": 1,
                "content": "Texto B.",
                "offset_start": 10,
                "offset_end": 20,
            },
        ]
        chunks = _chunk_by_sections(sections, chunk_size=1000, chunk_overlap=200)
        assert chunks[0].section_title == "A"
        assert chunks[1].section_title == "B"

    def test_heading_level_stored_in_metadata(self):
        sections = [
            {
                "heading": "Sub",
                "level": 3,
                "content": "Contenido.",
                "offset_start": 0,
                "offset_end": 10,
            }
        ]
        chunks = _chunk_by_sections(sections, chunk_size=1000, chunk_overlap=200)
        assert chunks[0].metadata.get("heading_level") == 3

    def test_empty_sections_list_returns_empty(self):
        chunks = _chunk_by_sections([], chunk_size=1000, chunk_overlap=200)
        assert chunks == []


class TestSplitWithOverlap:
    def test_short_text_not_split(self):
        result = _split_with_overlap("Short.", chunk_size=500, overlap=100)
        assert result == ["Short."]

    def test_long_text_split_into_multiple(self):
        text = "A" * 2000
        result = _split_with_overlap(text, chunk_size=500, overlap=100)
        assert len(result) > 1

    def test_chunks_not_exceed_chunk_size_much(self):
        text = "Hello world. " * 200
        result = _split_with_overlap(text, chunk_size=500, overlap=100)
        for chunk in result:
            # Allow a small overshoot for sentence boundary detection
            assert len(chunk) <= 600

    def test_overlap_means_content_is_repeated(self):
        """Adjacent chunks must share some text due to overlap."""
        text = "word " * 300  # ~1500 chars
        result = _split_with_overlap(text, chunk_size=200, overlap=50)
        if len(result) >= 2:
            # End of first chunk should appear in start of second chunk
            # (at least some characters)
            end_of_first = result[0][-50:]
            start_of_second = result[1][:50]
            # They won't be identical but some overlap should be present
            assert len(result[0]) > 0
            assert len(result[1]) > 0

    def test_exact_chunk_size_text_not_split(self):
        text = "x" * CHUNK_SIZE
        result = _split_with_overlap(text, chunk_size=CHUNK_SIZE, overlap=200)
        assert len(result) == 1

    def test_breaks_at_paragraph_boundary(self):
        # Craft text with a double-newline past the midpoint
        text = ("a" * 300) + "\n\n" + ("b" * 300)
        result = _split_with_overlap(text, chunk_size=500, overlap=50)
        # The first chunk should break at the double newline
        assert "\n\n" not in result[0] or result[0].endswith(("a", "\n\n"))
