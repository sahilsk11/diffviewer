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
def test_recommendations_route_uses_authenticated_author_search(tmp_path: Path) -> None:
    respx.get("https://api.github.test/user").mock(
        return_value=httpx.Response(200, json={"login": "sahilsk11"})
    )
    search_route = respx.get("https://api.github.test/search/issues").mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "html_url": "https://github.com/sahilsk11/DiffViewer/pull/14",
                        "title": "Add recommendations",
                        "number": 14,
                        "created_at": "2026-05-31T10:00:00Z",
                        "updated_at": "2026-05-31T10:30:00Z",
                        "user": {"login": "sahilsk11"},
                        "pull_request": {},
                    }
                ]
            },
        )
    )
    app = create_app(
        Settings(
            github_token="secret-token",
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/api/pull-requests/recommendations")

    assert response.status_code == 200
    assert response.json() == {
        "recommendations": [
            {
                "ref": {"owner": "sahilsk11", "repo": "DiffViewer", "pullNumber": 14},
                "title": "Add recommendations",
                "htmlUrl": "https://github.com/sahilsk11/DiffViewer/pull/14",
                "author": "sahilsk11",
                "createdAt": "2026-05-31T10:00:00Z",
                "updatedAt": "2026-05-31T10:30:00Z",
            }
        ]
    }
    assert search_route.calls.last is not None
    assert search_route.calls.last.request.url.params["q"] == (
        "is:pr is:open archived:false author:sahilsk11"
    )


@respx.mock
def test_recommendations_route_uses_configured_repositories(tmp_path: Path) -> None:
    search_route = respx.get("https://api.github.test/search/issues").mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "html_url": "https://github.com/acme/widget/pull/2",
                        "title": "Newest",
                        "number": 2,
                        "created_at": "2026-05-31T11:00:00Z",
                        "updated_at": "2026-05-31T11:30:00Z",
                        "user": {"login": "mona"},
                        "pull_request": {},
                    }
                ]
            },
        )
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
            diffviewer_recommended_pr_repos_raw="acme/widget",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/api/pull-requests/recommendations")

    assert response.status_code == 200
    assert (
        response.json()["recommendations"][0]["htmlUrl"] == "https://github.com/acme/widget/pull/2"
    )
    assert search_route.calls.last is not None
    assert search_route.calls.last.request.url.params["q"] == (
        "repo:acme/widget is:pr is:open archived:false"
    )


@respx.mock
def test_recommendations_route_returns_three_sorted_by_updated_time(tmp_path: Path) -> None:
    respx.get("https://api.github.test/user").mock(
        return_value=httpx.Response(200, json={"login": "sahilsk11"})
    )
    respx.get("https://api.github.test/search/issues").mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "html_url": f"https://github.com/acme/widget/pull/{number}",
                        "title": f"PR {number}",
                        "number": number,
                        "created_at": f"2026-05-2{number}T10:00:00Z",
                        "updated_at": {
                            1: "2026-05-31T09:00:00Z",
                            2: "2026-05-31T12:00:00Z",
                            3: "2026-05-31T10:00:00Z",
                            4: "2026-05-31T11:00:00Z",
                        }[number],
                        "user": {"login": "sahilsk11"},
                        "pull_request": {},
                    }
                    for number in [1, 2, 3, 4]
                ]
            },
        )
    )
    app = create_app(
        Settings(
            github_token="secret-token",
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/api/pull-requests/recommendations")

    assert response.status_code == 200
    assert [
        recommendation["ref"]["pullNumber"] for recommendation in response.json()["recommendations"]
    ] == [2, 4, 3]


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
            json={
                "body": "Comment text",
                "path": "src/example.ts",
                "line": 42,
                "side": "RIGHT",
                "headSha": "head_sha",
            },
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
                "headSha": "head_sha",
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
def test_comment_route_rejects_stale_head_sha(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "new_head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(200, json=[]),
    )
    comment_route = respx.post("https://api.github.test/repos/OWNER/REPO/pulls/123/comments").mock(
        return_value=httpx.Response(500, json={"message": "should not post"}),
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
                "headSha": "old_head_sha",
            },
        )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "error": "Pull request changed. Refresh before commenting.",
        "code": "stale_pull_request",
        "currentHeadSha": "new_head_sha",
        "expectedHeadSha": "old_head_sha",
    }
    assert not comment_route.called


@respx.mock
def test_files_route_rejects_stale_revision(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "new_head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
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
        response = client.get(
            "/api/repos/OWNER/REPO/pulls/123/files",
            params={"baseSha": "old_base_sha", "headSha": "old_head_sha"},
        )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "error": "Pull request changed. Refresh before viewing files.",
        "code": "stale_pull_request",
        "currentBaseSha": "base_sha",
        "currentHeadSha": "new_head_sha",
        "expectedBaseSha": "old_base_sha",
        "expectedHeadSha": "old_head_sha",
    }
    assert not files_route.called


@respx.mock
def test_files_route_force_refreshes_files_after_revision_match(tmp_path: Path) -> None:
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
    files_route = respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        side_effect=[
            httpx.Response(
                200,
                json=[
                    {
                        "filename": "src/old.ts",
                        "status": "modified",
                        "additions": 1,
                        "deletions": 1,
                        "changes": 2,
                        "patch": "@@ old",
                    },
                ],
            ),
            httpx.Response(
                200,
                json=[
                    {
                        "filename": "src/current.ts",
                        "status": "modified",
                        "additions": 2,
                        "deletions": 1,
                        "changes": 3,
                        "patch": "@@ current",
                    },
                ],
            ),
        ],
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        cached_response = client.get("/api/repos/OWNER/REPO/pulls/123/files")
        guarded_response = client.get(
            "/api/repos/OWNER/REPO/pulls/123/files",
            params={"baseSha": "base_sha", "headSha": "head_sha"},
        )

    assert cached_response.status_code == 200
    assert cached_response.json()["files"][0]["path"] == "src/old.ts"
    assert guarded_response.status_code == 200
    assert guarded_response.json()["files"][0]["path"] == "src/current.ts"
    assert len(files_route.calls) == 2


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
            params={
                "path": "src/example.ts",
                "side": "LEFT",
                "baseSha": "base_sha",
                "headSha": "head_sha",
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "path": "src/example.ts",
        "side": "LEFT",
        "sha": "base_blob_sha",
        "contents": "base content",
    }
    assert base_tree_route.called


@respx.mock
def test_contents_route_rejects_stale_revision(tmp_path: Path) -> None:
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
        return_value=httpx.Response(
            200,
            json={
                "title": "PR title",
                "html_url": "https://github.com/OWNER/REPO/pull/123",
                "base": {"sha": "base_sha"},
                "head": {"sha": "new_head_sha", "ref": "branch-name"},
                "user": {"login": "login"},
            },
        ),
    )
    respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123/files").mock(
        return_value=httpx.Response(200, json=[]),
    )
    tree_route = respx.get("https://api.github.test/repos/OWNER/REPO/git/trees/old_head_sha").mock(
        return_value=httpx.Response(500, json={"message": "should not load tree"}),
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
            params={
                "path": "src/example.ts",
                "side": "RIGHT",
                "baseSha": "base_sha",
                "headSha": "old_head_sha",
            },
        )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "error": "Pull request changed. Refresh before viewing files.",
        "code": "stale_pull_request",
        "currentBaseSha": "base_sha",
        "currentHeadSha": "new_head_sha",
        "expectedBaseSha": "base_sha",
        "expectedHeadSha": "old_head_sha",
    }
    assert not tree_route.called


@respx.mock
def test_contents_route_reuses_cached_pull_request_tree_and_blob(tmp_path: Path) -> None:
    pr_route = respx.get("https://api.github.test/repos/OWNER/REPO/pulls/123").mock(
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
    tree_route = respx.get("https://api.github.test/repos/OWNER/REPO/git/trees/head_sha").mock(
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
    blob_route = respx.get("https://api.github.test/repos/OWNER/REPO/git/blobs/head_blob_sha").mock(
        return_value=httpx.Response(
            200,
            json={"encoding": "base64", "content": "aGVhZCBjb250ZW50"},
        ),
    )
    app = create_app(
        Settings(
            github_api_base_url="https://api.github.test",
            diffviewer_db_path=tmp_path / "test.sqlite3",
        ),
    )

    with TestClient(app) as client:
        first_response = client.get(
            "/api/repos/OWNER/REPO/pulls/123/contents",
            params={
                "path": "src/example.ts",
                "side": "RIGHT",
                "baseSha": "base_sha",
                "headSha": "head_sha",
            },
        )
        second_response = client.get(
            "/api/repos/OWNER/REPO/pulls/123/contents",
            params={
                "path": "src/example.ts",
                "side": "RIGHT",
                "baseSha": "base_sha",
                "headSha": "head_sha",
            },
        )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json()["contents"] == "head content"
    assert len(pr_route.calls) == 2
    assert len(tree_route.calls) == 1
    assert len(blob_route.calls) == 1
