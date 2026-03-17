import io

from minio import Minio

from src.config import settings


class MinioStorage:
    def __init__(self):
        self._client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        self._bucket = settings.MINIO_BUCKET

    def download_file(self, file_url: str) -> bytes:
        """Download a file from MinIO and return its bytes."""
        # file_url is the object name/key in the bucket
        response = self._client.get_object(self._bucket, file_url)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
