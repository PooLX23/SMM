from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    AUTH_MODE: str = "entra"  # dev | entra

    ENTRA_TENANT_ID: str | None = None
    ENTRA_AUDIENCE: str | None = None
    RECEPTION_GROUP_ID: str | None = None

settings = Settings()
