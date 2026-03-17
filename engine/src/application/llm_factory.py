from langchain_core.language_models import BaseChatModel
from langchain_core.embeddings import Embeddings

from src.config import settings


class LLMFactory:
    @staticmethod
    def create_chat_model() -> BaseChatModel:
        provider = settings.LLM_PROVIDER
        model = settings.LLM_MODEL
        temperature = settings.LLM_TEMPERATURE

        match provider:
            case "openai":
                from langchain_openai import ChatOpenAI

                return ChatOpenAI(model=model, temperature=temperature)
            case "gemini":
                from langchain_google_genai import ChatGoogleGenerativeAI

                return ChatGoogleGenerativeAI(model=model, temperature=temperature)
            case _:
                raise ValueError(f"Unsupported LLM provider: {provider}")

    @staticmethod
    def create_embeddings() -> Embeddings:
        provider = settings.EMBEDDING_PROVIDER
        model = settings.EMBEDDING_MODEL

        match provider:
            case "openai":
                from langchain_openai import OpenAIEmbeddings

                return OpenAIEmbeddings(model=model)
            case "gemini":
                from langchain_google_genai import GoogleGenerativeAIEmbeddings

                return GoogleGenerativeAIEmbeddings(model=model)
            case _:
                raise ValueError(f"Unsupported embedding provider: {provider}")
