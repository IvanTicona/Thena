from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://thena:thena@postgres:5432/thena"

    # Redis
    REDIS_URL: str = "redis://redis:6379"

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "thena"
    MINIO_SECRET_KEY: str = "thena-secret"
    MINIO_BUCKET: str = "thena-documents"
    MINIO_USE_SSL: bool = False

    # LLM
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE: float = 0.1

    # Embedding
    EMBEDDING_PROVIDER: str = "openai"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # RAG
    RAG_TOP_K: int = 10
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    RAG_TUTOR_WEIGHT: float = 1.5

    # API Keys (optional, depends on provider)
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
