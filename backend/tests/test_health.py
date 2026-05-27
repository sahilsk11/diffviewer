from pathlib import Path

from fastapi.testclient import TestClient

from diffviewer_api.config import Settings
from diffviewer_api.main import create_app


def test_healthz(tmp_path: Path) -> None:
    app = create_app(Settings(diffviewer_db_path=tmp_path / "test.sqlite3"))

    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
