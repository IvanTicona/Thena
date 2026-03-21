import logging
from dataclasses import dataclass

from src.domain.entities import DocumentSectionDict

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    content: str
    section_title: str | None
    chunk_index: int
    metadata: dict[str, str | int | None]


CHUNK_SIZE = 1000  # characters
CHUNK_OVERLAP = 200  # characters


def chunk_text(
    full_text: str,
    sections: list[DocumentSectionDict] | None = None,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
) -> list[TextChunk]:
    """Split text into overlapping chunks, respecting section boundaries when possible."""
    if sections:
        return _chunk_by_sections(sections, chunk_size, chunk_overlap)
    return _chunk_plain(full_text, chunk_size, chunk_overlap)


def _chunk_by_sections(
    sections: list[DocumentSectionDict], chunk_size: int, chunk_overlap: int
) -> list[TextChunk]:
    """Chunk text respecting section boundaries."""
    chunks: list[TextChunk] = []
    chunk_index = 0

    for section in sections:
        heading = section.get("heading", "")
        content = section.get("content", "")
        level = section.get("level", 1)
        section_text = f"{heading}\n{content}" if content else heading

        if len(section_text) <= chunk_size:
            chunks.append(
                TextChunk(
                    content=section_text,
                    section_title=heading,
                    chunk_index=chunk_index,
                    metadata={"heading_level": level},
                )
            )
            chunk_index += 1
        else:
            # Split large sections into overlapping chunks
            sub_chunks = _split_with_overlap(
                section_text, chunk_size, chunk_overlap
            )
            for sc in sub_chunks:
                chunks.append(
                    TextChunk(
                        content=sc,
                        section_title=heading,
                        chunk_index=chunk_index,
                        metadata={"heading_level": level},
                    )
                )
                chunk_index += 1

    return chunks


def _chunk_plain(
    text: str, chunk_size: int, chunk_overlap: int
) -> list[TextChunk]:
    """Simple overlapping chunker for unstructured text."""
    chunks: list[TextChunk] = []
    sub_chunks = _split_with_overlap(text, chunk_size, chunk_overlap)
    for i, sc in enumerate(sub_chunks):
        chunks.append(
            TextChunk(
                content=sc,
                section_title=None,
                chunk_index=i,
                metadata={},
            )
        )
    return chunks


def _split_with_overlap(
    text: str, chunk_size: int, overlap: int
) -> list[str]:
    """Split text into overlapping windows, trying to break at paragraph/sentence boundaries."""
    if len(text) <= chunk_size:
        return [text]

    results: list[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end < len(text):
            # Try to break at a paragraph boundary
            para_break = text.rfind("\n\n", start, end)
            if para_break > start + chunk_size // 2:
                end = para_break + 2
            else:
                # Try sentence boundary
                for sep in [". ", ".\n", "? ", "! "]:
                    sent_break = text.rfind(sep, start, end)
                    if sent_break > start + chunk_size // 2:
                        end = sent_break + len(sep)
                        break

        results.append(text[start:end].strip())

        if end >= len(text):
            break

        start = end - overlap

    return results
