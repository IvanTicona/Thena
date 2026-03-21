from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://thena:thena@postgres:5432/thena",
        description="PostgreSQL connection string (with pgvector extension)",
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://redis:6379",
        description="Redis connection URL for BullMQ job queue",
    )

    # MinIO
    MINIO_ENDPOINT: str = Field(
        default="minio",
        description="MinIO server hostname",
    )
    MINIO_PORT: int = Field(
        default=9000,
        description="MinIO server port",
    )
    MINIO_ACCESS_KEY: str = Field(default="thena", description="MinIO access key")
    MINIO_SECRET_KEY: str = Field(default="thena-secret", description="MinIO secret key")
    MINIO_BUCKET: str = Field(
        default="thena-documents",
        description="MinIO bucket for uploaded thesis documents",
    )
    MINIO_USE_SSL: bool = Field(default=False, description="Use SSL for MinIO connections")

    # LLM
    LLM_PROVIDER: str = Field(
        default="openai",
        description="LLM provider: 'openai' or 'gemini'",
    )
    LLM_MODEL: str = Field(
        default="gpt-4o-mini",
        description="Chat model name passed to the LLM provider",
    )
    LLM_TEMPERATURE: float = Field(
        default=0.1,
        ge=0.0,
        le=2.0,
        description="Sampling temperature for LLM responses",
    )

    # Embedding
    EMBEDDING_PROVIDER: str = Field(
        default="openai",
        description="Embedding provider: 'openai' or 'gemini'",
    )
    EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        description="Embedding model name passed to the provider",
    )

    # RAG
    RAG_TOP_K: int = Field(
        default=10,
        ge=1,
        description="Number of top chunks to retrieve from the knowledge base",
    )
    RAG_SIMILARITY_THRESHOLD: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity for retrieved chunks",
    )
    RAG_TUTOR_WEIGHT: float = Field(
        default=1.5,
        ge=1.0,
        description="Boost multiplier applied to TUTOR-layer chunks during retrieval",
    )

    # API Keys (optional, depends on provider)
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    GOOGLE_API_KEY: str = Field(default="", description="Google AI API key")

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
