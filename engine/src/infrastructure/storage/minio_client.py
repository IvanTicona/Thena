import logging

from minio import Minio

from src.config import settings
from src.domain.ports import FileStoragePort

logger = logging.getLogger(__name__)


class MinioStorage(FileStoragePort):
    def __init__(self) -> None:
        self._client = Minio(
            f"{settings.MINIO_ENDPOINT}:{settings.MINIO_PORT}",
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        self._bucket = settings.MINIO_BUCKET

    def download_file(self, file_url: str) -> bytes:
        """Download a file from MinIO and return its bytes."""
        # file_url may include the bucket prefix — strip it
        object_name = file_url
        if object_name.startswith(f"{self._bucket}/"):
            object_name = object_name[len(self._bucket) + 1:]
        logger.info("Downloading %s from bucket %s", object_name, self._bucket)
        response = self._client.get_object(self._bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def upload_file(
        self, bucket: str, key: str, data: bytes, content_type: str
    ) -> str:
        """Upload bytes to MinIO and return the object path."""
        import io
        self._client.put_object(
            bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return f"{bucket}/{key}"
