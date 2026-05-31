from pathlib import Path

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from diffviewer_api import main
from diffviewer_api.config import Settings


def create_static_app(tmp_path: Path, monkeypatch: MonkeyPatch) -> TestClient:
    static_dir = tmp_path / "dist"
    asset_dir = static_dir / "assets"
    asset_dir.mkdir(parents=True)
    (static_dir / "index.html").write_text(
        "<!doctype html><div id=\"root\"></div>",
        encoding="utf-8",
    )
    (asset_dir / "app.js").write_text("console.log('ok');", encoding="utf-8")
    monkeypatch.setattr(main, "DEFAULT_STATIC_DIR", static_dir)

    app = main.create_app(Settings(diffviewer_db_path=tmp_path / "test.sqlite3"))
    return TestClient(app)


def test_spa_deep_link_serves_index_html(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    with create_static_app(tmp_path, monkeypatch) as client:
        response = client.get("/diff?pr=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F1")

    assert response.status_code == 200
    assert response.text == "<!doctype html><div id=\"root\"></div>"


def test_static_assets_still_serve_from_dist(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    with create_static_app(tmp_path, monkeypatch) as client:
        response = client.get("/assets/app.js")

    assert response.status_code == 200
    assert response.text == "console.log('ok');"


def test_missing_api_paths_do_not_fall_back_to_index_html(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    with create_static_app(tmp_path, monkeypatch) as client:
        response = client.get("/api/does-not-exist")

    assert response.status_code == 404
