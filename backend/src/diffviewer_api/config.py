import getpass
import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlparse

from pydantic import AliasChoices, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

GITHUB_TOKEN_KEYS = ("GITHUB_TOKEN", "GH_TOKEN")


def _clean_secret_value(value: str) -> str | None:
    cleaned = value.strip().strip("'\"")
    return cleaned or None


def _read_env_token(path: Path) -> str | None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("export "):
            stripped = stripped.removeprefix("export ").strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip() in GITHUB_TOKEN_KEYS:
            return _clean_secret_value(value)
    return None


def _read_gh_hosts_token(path: Path) -> str | None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    in_github_host = False
    for line in lines:
        if line.startswith("github.com:"):
            in_github_host = True
            continue
        if in_github_host and line and not line.startswith((" ", "\t")):
            in_github_host = False
        if not in_github_host or ":" not in line:
            continue
        key, value = line.strip().split(":", 1)
        if key in {"oauth_token", "token"}:
            return _clean_secret_value(value)
    return None


def _read_git_credentials_token(path: Path) -> str | None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    for line in lines:
        parsed = urlparse(line.strip())
        if parsed.hostname != "github.com" or not parsed.password:
            continue
        return _clean_secret_value(unquote(parsed.password))
    return None


def github_token_search_paths(home: Path | None = None, username: str | None = None) -> list[Path]:
    resolved_home = home or Path.home()
    resolved_username = username or os.environ.get("USER") or getpass.getuser()
    return [
        Path(f"/etc/{resolved_username}/secrets.env"),
        Path("/etc/sas/secrets.env"),
        Path("/etc/sas-system/secrets.env"),
        resolved_home / ".config" / "gh" / "hosts.yml",
        resolved_home / ".git-credentials",
    ]


def discover_github_token(search_paths: list[Path] | None = None) -> str | None:
    paths = search_paths or github_token_search_paths()
    for path in paths:
        suffix = path.name
        if suffix == "hosts.yml":
            token = _read_gh_hosts_token(path)
        elif suffix == ".git-credentials":
            token = _read_git_credentials_token(path)
        else:
            token = _read_env_token(path)
        if token is not None:
            return token
    return None


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
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_api_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias="OPENAI_API_BASE_URL",
    )
    openai_model: str = Field(default="gpt-4o-mini", validation_alias="OPENAI_MODEL")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @field_validator("github_token", mode="before")
    @classmethod
    def empty_token_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def empty_openai_api_key_as_none(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @model_validator(mode="after")
    def load_local_github_token(self) -> "Settings":
        if self.github_token is None:
            self.github_token = discover_github_token()
        return self

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
