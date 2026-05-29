from pathlib import Path

import httpx
import respx
from fastapi.testclient import TestClient

from diffviewer_api.config import Settings
from diffviewer_api.main import create_app


def pull_request_payload(
    *, base_sha: str = "base_sha", head_sha: str = "head_sha"
) -> dict[str, object]:
    return {
        "title": "PR title",
        "html_url": "https://github.com/OWNER/REPO/pull/123",
        "base": {"sha": base_sha},
        "head": {"sha": head_sha, "ref": "branch-name"},
        "user": {"login": "login"},
    }


@respx.mock
def test_generate_file_insights_route_returns_cached_batch(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(200, json=pull_request_payload()),
    )
    files_route = respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "filename": "src/example.ts",
                    "status": "modified",
                    "additions": 2,
                    "deletions": 1,
                    "changes": 3,
                    "patch": "@@ ...",
                },
            ],
        ),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        first = client.post(
            "/api/repos/OWNER/REPO/pulls/123/insights/files",
            json={"baseSha": "base_sha", "headSha": "head_sha"},
        )
        second = client.post(
            "/api/repos/OWNER/REPO/pulls/123/insights/files",
            json={"baseSha": "base_sha", "headSha": "head_sha"},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["provider"] == "local"
    assert first.json()["insights"][0]["path"] == "src/example.ts"
    assert len(files_route.calls) == 1


@respx.mock
def test_generate_file_insights_route_rejects_stale_revision(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json=pull_request_payload(base_sha="new_base_sha", head_sha="new_head_sha"),
        ),
    )
    files_route = respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(500, json={"message": "should not list files"}),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/repos/OWNER/REPO/pulls/123/insights/files",
            json={"baseSha": "base_sha", "headSha": "head_sha"},
        )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "error": "Pull request changed. Refresh before generating insights.",
        "code": "stale_pull_request",
        "currentBaseSha": "new_base_sha",
        "currentHeadSha": "new_head_sha",
        "expectedBaseSha": "base_sha",
        "expectedHeadSha": "head_sha",
    }
    assert not files_route.called


@respx.mock
def test_explain_code_route_uses_selected_code_without_loading_contents(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(200, json=pull_request_payload()),
    )
    tree_route = respx.get("https://api.github.test/repos/OWNER/REPO/git/trees/head_sha").mock(
        return_value=httpx.Response(500, json={"message": "should not load tree"}),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/repos/OWNER/REPO/pulls/123/insights/explain",
            json={
                "baseSha": "base_sha",
                "headSha": "head_sha",
                "path": "src/example.ts",
                "side": "RIGHT",
                "startLine": 2,
                "endLine": 3,
                "selectedCode": "const value = 1;",
            },
        )

    assert response.status_code == 200
    assert response.json()["selectedCode"] == "const value = 1;"
    assert "src/example.ts" in response.json()["label"]
    assert not tree_route.called


@respx.mock
def test_explain_code_route_reads_file_contents_when_selection_missing(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(200, json=pull_request_payload()),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/git/trees/head_sha").mock(
        return_value=httpx.Response(
            200,
            json={
                "truncated": False,
                "tree": [
                    {
                        "path": "src/example.ts",
                        "type": "blob",
                        "sha": "head_blob_sha",
                        "size": 12,
                    },
                ],
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/git/blobs/head_blob_sha").mock(
        return_value=httpx.Response(
            200,
            json={"encoding": "base64", "content": "b25lCnR3bwp0aHJlZQ=="},
        ),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/repos/OWNER/REPO/pulls/123/insights/explain",
            json={
                "baseSha": "base_sha",
                "headSha": "head_sha",
                "path": "src/example.ts",
                "side": "RIGHT",
                "startLine": 2,
                "endLine": 3,
            },
        )

    assert response.status_code == 200
    assert response.json()["selectedCode"] == "two\nthree"
