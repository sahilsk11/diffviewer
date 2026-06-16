from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    github_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GITHUB_TOKEN", "GH_TOKEN"),
    )
    github_api_base_url: str = Field(
        default="https://api.github.com",
        validation_alias="GITHUB_API_BASE_URL",
    )
    diffviewer_db_path: Path | None = Field(default=None, validation_alias="DIFFVIEWER_DB_PATH")
    diffviewer_cors_origins_raw: str = Field(
        default="http://localhost:3000",
        validation_alias="DIFFVIEWER_CORS_ORIGINS",
    )
    codex_cli_command: str = Field(default="codex", validation_alias="CODEX_CLI_COMMAND")
    codex_model: str | None = Field(default=None, validation_alias="CODEX_MODEL")
    codex_timeout_seconds: float = Field(
        default=120.0,
        validation_alias="CODEX_TIMEOUT_SECONDS",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @field_validator("github_token", mode="before")
    @classmethod
    def empty_token_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("codex_model", mode="before")
    @classmethod
    def empty_codex_model_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("diffviewer_db_path", mode="before")
    @classmethod
    def empty_path_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("diffviewer_cors_origins_raw", mode="before")
    @classmethod
    def empty_cors_origins_as_default(cls, value: object) -> object:
        if value == "":
            return "http://localhost:3000"
        return value

    @computed_field
    @property
    def diffviewer_cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.diffviewer_cors_origins_raw.split(",")
            if origin.strip()
        ]

    @property
    def db_path(self) -> Path:
        if self.diffviewer_db_path is not None:
            return self.diffviewer_db_path.expanduser()
        return Path.home() / ".diffviewer" / "diffviewer.sqlite3"


@lru_cache
def get_settings() -> Settings:
    return Settings()
