from pathlib import Path

import httpx
import respx
from fastapi.testclient import TestClient

from diffviewer_api.config import Settings
from diffviewer_api.main import create_app
from diffviewer_api.services.pull_request_service import parse_pull_request_url


def test_parse_pull_request_url() -> None:
    parsed = parse_pull_request_url("https://github.com/OWNER/REPO/pull/123")

    assert parsed.owner == "OWNER"
    assert parsed.repo == "REPO"
    assert parsed.pull_number == 123


@respx.mock
def test_load_pull_request_route_maps_github_payload(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "filename": "src/example.ts",
                    "status": "modified",
                    "additions": 10,
                    "deletions": 2,
                    "changes": 12,
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
        response = client.post(
            "/api/pull-requests/load",
            json={"url": "https://github.com/OWNER/REPO/pull/123"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "ref": {"owner": "OWNER", "repo": "REPO", "pullNumber": 123},
        "title": "PR title",
        "htmlUrl": "https://github.com/OWNER/REPO/pull/123",
        "baseSha": "base_sha",
        "headSha": "head_sha",
        "headRef": "branch-name",
        "author": "login",
        "files": [
            {
                "path": "src/example.ts",
                "status": "modified",
                "additions": 10,
                "deletions": 2,
                "changes": 12,
                "patch": "@@ ...",
            },
        ],
        "readState": {"approved": [], "flagged": [], "skipped": []},
    }


@respx.mock
def test_comment_route_maps_single_line_payload(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(200, json=[]),
    )
    comment_route = respx.post("https://api.github.test/repos/OWNER/REPO/pulls/123/comments").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 123456,
                "html_url": "https://github.com/OWNER/REPO/pull/123#discussion_r123456",
                "path": "src/example.ts",
                "line": 42,
                "side": "RIGHT",
                "body": "Comment text",
            },
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
            "/api/repos/OWNER/REPO/pulls/123/comments",
            json={"body": "Comment text", "path": "src/example.ts", "line": 42, "side": "RIGHT"},
        )

    assert response.status_code == 200
    assert comment_route.calls.last is not None
    assert comment_route.calls.last.request.read()
    assert response.json()["htmlUrl"].endswith("#discussion_r123456")
    assert comment_route.calls.last.request.content == (
        b'{"body":"Comment text","commit_id":"head_sha","path":"src/example.ts",'
        b'"line":42,"side":"RIGHT"}'
    )


@respx.mock
def test_comment_route_maps_multi_line_payload(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(200, json=[]),
    )
    comment_route = respx.post("https://api.github.test/repos/OWNER/REPO/pulls/123/comments").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 123456,
                "html_url": "https://github.com/OWNER/REPO/pull/123#discussion_r123456",
                "path": "src/example.ts",
                "line": 42,
                "side": "RIGHT",
                "body": "Comment text",
            },
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
            "/api/repos/OWNER/REPO/pulls/123/comments",
            json={
                "body": "Comment text",
                "path": "src/example.ts",
                "line": 42,
                "side": "RIGHT",
                "startLine": 40,
                "startSide": "RIGHT",
            },
        )

    assert response.status_code == 200
    assert comment_route.calls.last is not None
    assert comment_route.calls.last.request.content == (
        b'{"body":"Comment text","commit_id":"head_sha","path":"src/example.ts",'
        b'"line":42,"side":"RIGHT","start_line":40,"start_side":"RIGHT"}'
    )


@respx.mock
def test_contents_route_uses_base_tree_for_left_side(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(200, json=[]),
    )
    base_tree_route = respx.get("https://api.github.test/repos/OWNER/REPO/git/trees/base_sha").mock(
        return_value=httpx.Response(
            200,
            json={
                "truncated": False,
                "tree": [
                    {
                        "path": "src/example.ts",
                        "type": "blob",
                        "sha": "base_blob_sha",
                        "size": 12,
                    },
                ],
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/git/blobs/base_blob_sha").mock(
        return_value=httpx.Response(
            200,
            json={"encoding": "base64", "content": "YmFzZSBjb250ZW50"},
        ),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.get(
            "/api/repos/OWNER/REPO/pulls/123/contents",
            params={"path": "src/example.ts", "side": "LEFT"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "path": "src/example.ts",
        "side": "LEFT",
        "sha": "base_blob_sha",
        "contents": "base content",
    }
    assert base_tree_route.called
