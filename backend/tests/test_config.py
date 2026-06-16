from diffviewer_api.config import Settings


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


def test_empty_github_token_is_none() -> None:
    settings = Settings(github_token="")

    assert settings.github_token is None
