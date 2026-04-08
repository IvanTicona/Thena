from dataclasses import dataclass, field
from enum import Enum
from typing import TypedDict


class ObservationType(str, Enum):
    STRUCTURE = "STRUCTURE"
    METHODOLOGY = "METHODOLOGY"
    COHERENCE = "COHERENCE"
    CITATIONS = "CITATIONS"
    FORMAT = "FORMAT"
    INTEGRITY = "INTEGRITY"


class Severity(str, Enum):
    INFO = "INFO"
    SUGGESTION = "SUGGESTION"
    WARNING = "WARNING"
    ERROR = "ERROR"


# ── TypedDicts for unstructured dict usage ───────────────────────


class DocumentSectionDict(TypedDict):
    heading: str
    level: int
    content: str
    offset_start: int
    offset_end: int


class PreviousChapterDict(TypedDict):
    chapter_number: int
    chapter_title: str
    markdown_content: str


class RagChunkDict(TypedDict):
    chunk_id: str
    content: str
    metadata: dict[str, str]
    document_title: str
    layer: str
    section: str
    similarity: float


class FindingDict(TypedDict, total=False):
    type: str
    severity: str
    message: str
    suggestion: str | None
    textFragment: str | None
    offsetStart: int | None
    offsetEnd: int | None
    sourceReference: dict[str, str] | None


class ChapterInfoDict(TypedDict):
    chapter_number: int
    chapter_title: str
    student_id: str
    tutor_id: str | None


# ── Dataclasses ──────────────────────────────────────────────────


@dataclass
class SourceReference:
    layer: str
    chunk_id: str
    document_title: str
    section: str


@dataclass
class Observation:
    type: ObservationType
    severity: Severity
    message: str
    suggestion: str | None = None
    text_fragment: str | None = None
    offset_start: int | None = None
    offset_end: int | None = None
    source_reference: SourceReference | None = None

    def to_dict(self) -> dict[str, str | int | dict[str, str] | None]:
        result = {
            "type": self.type.value,
            "severity": self.severity.value,
            "message": self.message,
        }
        if self.suggestion:
            result["suggestion"] = self.suggestion
        if self.text_fragment:
            result["textFragment"] = self.text_fragment
        if self.offset_start is not None:
            result["offsetStart"] = self.offset_start
        if self.offset_end is not None:
            result["offsetEnd"] = self.offset_end
        if self.source_reference:
            result["sourceReference"] = {
                "layer": self.source_reference.layer,
                "chunkId": self.source_reference.chunk_id,
                "documentTitle": self.source_reference.document_title,
                "section": self.source_reference.section,
            }
        return result


@dataclass
class DocumentSection:
    heading: str
    level: int
    content: str
    offset_start: int
    offset_end: int


@dataclass
class ParsedDocument:
    full_text: str
    markdown: str
    sections: list[DocumentSection] = field(default_factory=list)


class ReviewState(TypedDict, total=False):
    # Input
    submission_id: str
    chapter_number: int
    chapter_title: str
    document_text: str
    document_sections: list[DocumentSectionDict]
    markdown_content: str
    previous_chapters: list[PreviousChapterDict]
    rag_context: list[RagChunkDict]
    bibliography_context: list[RagChunkDict]
    tutor_id: str | None

    # Agent outputs
    structure_findings: list[FindingDict]
    methodology_findings: list[FindingDict]
    coherence_findings: list[FindingDict]
    citations_findings: list[FindingDict]
    format_findings: list[FindingDict]
    integrity_findings: list[FindingDict]

    # Final output
    observations: list[FindingDict]
    summary: str

    # Error tracking
    agent_errors: dict[str, str]
