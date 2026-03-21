import io
import logging
from dataclasses import dataclass, field

from PyPDF2 import PdfReader

from src.domain.entities import DocumentSectionDict

logger = logging.getLogger(__name__)


@dataclass
class ParsedPDF:
    full_text: str
    sections: list[DocumentSectionDict] = field(default_factory=list)


def parse_pdf(file_bytes: bytes) -> ParsedPDF:
    """Extract text from a PDF file, splitting by pages as pseudo-sections."""
    logger.info("Parsing PDF file (%d bytes)", len(file_bytes))
    reader = PdfReader(io.BytesIO(file_bytes))

    full_text_parts: list[str] = []
    sections: list[DocumentSectionDict] = []
    char_offset = 0

    for i, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        page_text = page_text.strip()

        if not page_text:
            continue

        full_text_parts.append(page_text)

        sections.append(
            {
                "heading": f"Pagina {i + 1}",
                "level": 1,
                "content": page_text,
                "offset_start": char_offset,
                "offset_end": char_offset + len(page_text),
            }
        )

        char_offset += len(page_text) + 1

    full_text = "\n".join(full_text_parts)
    logger.info("Parsed PDF: %d pages, %d sections, %d chars", len(reader.pages), len(sections), len(full_text))
    return ParsedPDF(full_text=full_text, sections=sections)
