import logging

from minio import Minio

from src.config import settings

logger = logging.getLogger(__name__)


class MinioStorage:
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
