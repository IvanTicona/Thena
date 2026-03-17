from dataclasses import dataclass, field

from PyPDF2 import PdfReader
import io


@dataclass
class ParsedPDF:
    full_text: str
    sections: list[dict] = field(default_factory=list)


def parse_pdf(file_bytes: bytes) -> ParsedPDF:
    """Extract text from a PDF file, splitting by pages as pseudo-sections."""
    reader = PdfReader(io.BytesIO(file_bytes))

    full_text_parts: list[str] = []
    sections: list[dict] = []
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
    return ParsedPDF(full_text=full_text, sections=sections)
