from pathlib import Path

from diffviewer_api.models.state import FileReviewState
from diffviewer_api.services.read_state_store import ReadStateStore
from diffviewer_api.storage.sqlite import connect


def test_state_insert_update_delete(tmp_path: Path) -> None:
    connection = connect(tmp_path / "state.sqlite3")
    store = ReadStateStore(connection)

    store.set("acme", "widget", 1, "src/app.ts", FileReviewState.approved)
    assert store.get("acme", "widget", 1).approved == ["src/app.ts"]

    store.set("acme", "widget", 1, "src/app.ts", FileReviewState.flagged)
    state = store.get("acme", "widget", 1)
    assert state.approved == []
    assert state.flagged == ["src/app.ts"]

    store.set("acme", "widget", 1, "src/app.ts", FileReviewState.unreviewed)
    state = store.get("acme", "widget", 1)
    assert state.approved == []
    assert state.flagged == []
    assert state.skipped == []

    connection.close()
