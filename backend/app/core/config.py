"""
Centralized app configuration, loaded from environment variables (.env).
Keeping this separate means no secrets or DB URLs are hardcoded anywhere else.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database ---
    DATABASE_URL: str = "postgresql://pce_user:pce_pass@localhost:5432/pce_navigator"

    # --- Auth ---
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # --- App ---
    PROJECT_NAME: str = "PCE Campus Navigator API"
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
    ]

    # --- Chatbot / fuzzy matching ---
    CHATBOT_MATCH_THRESHOLD: int = 60  # rapidfuzz score (0-100) below which we say "not found"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
