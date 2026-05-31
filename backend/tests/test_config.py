from pathlib import Path

from diffviewer_api.config import Settings, discover_github_token, github_token_search_paths


def test_cors_origins_parse_comma_separated_env() -> None:
    settings = Settings(
        diffviewer_cors_origins_raw="http://localhost:3000,https://pv-example.ultron.sh",
    )

    assert settings.diffviewer_cors_origins == [
        "http://localhost:3000",
        "https://pv-example.ultron.sh",
    ]


def test_explicit_github_token_wins() -> None:
    settings = Settings(github_token="explicit-token")

    assert settings.github_token == "explicit-token"


def test_github_token_search_paths_follow_sas_user_secret_convention() -> None:
    paths = github_token_search_paths(home=Path("/home/alice"), username="alice")

    assert paths[:3] == [
        Path("/etc/alice/secrets.env"),
        Path("/etc/sas/secrets.env"),
        Path("/etc/sas-system/secrets.env"),
    ]
    assert Path("/home/alice/.config/gh/hosts.yml") in paths


def test_discovers_github_token_from_env_file(tmp_path: Path) -> None:
    secrets = tmp_path / "secrets.env"
    secrets.write_text("OTHER=value\nGH_TOKEN='from-secret-file'\n", encoding="utf-8")

    assert discover_github_token([secrets]) == "from-secret-file"


def test_discovers_github_token_from_gh_hosts(tmp_path: Path) -> None:
    hosts = tmp_path / "hosts.yml"
    hosts.write_text(
        "github.com:\n"
        "    user: sahil\n"
        "    oauth_token: from-gh-hosts\n"
        "gist.github.com:\n"
        "    oauth_token: ignore-me\n",
        encoding="utf-8",
    )

    assert discover_github_token([hosts]) == "from-gh-hosts"

