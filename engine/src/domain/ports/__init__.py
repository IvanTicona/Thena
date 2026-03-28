from abc import ABC, abstractmethod

from src.domain.entities import (
    ChapterInfoDict,
    PreviousChapterDict,
    FindingDict,
    RagChunkDict,
)


class ReviewRepositoryPort(ABC):
    @abstractmethod
    def get_chapter_info(self, chapter_id: str) -> ChapterInfoDict: ...

    @abstractmethod
    def get_approved_chapters(self, chapter_id: str) -> list[PreviousChapterDict]: ...

    @abstractmethod
    def update_job_status(
        self, job_id: str, status: str, error_message: str | None = None
    ) -> None: ...

    @abstractmethod
    def update_submission_markdown(self, submission_id: str, markdown: str) -> None: ...

    @abstractmethod
    def save_results(
        self,
        job_id: str,
        summary: str,
        observations: list[FindingDict],
        agent_findings: dict[str, list[FindingDict]],
    ) -> None: ...


class RAGRetrieverPort(ABC):
    @abstractmethod
    def retrieve(
        self, query: str, tutor_id: str | None = None
    ) -> list[RagChunkDict]: ...

    @abstractmethod
    def format_context(self, chunks: list[RagChunkDict]) -> str: ...


class FileStoragePort(ABC):
    @abstractmethod
    def download_file(self, file_url: str) -> bytes: ...

    @abstractmethod
    def upload_file(
        self, bucket: str, key: str, data: bytes, content_type: str
    ) -> str: ...
