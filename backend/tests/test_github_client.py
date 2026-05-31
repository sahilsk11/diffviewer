import base64

import httpx
import pytest
import respx

from diffviewer_api.services.github_client import GitHubClient, GitHubError, decode_blob_contents


@pytest.mark.asyncio
@respx.mock
async def test_auth_header_is_added_server_side() -> None:
    route = respx.get("https://api.github.test/repos/acme/widget/pulls/1").mock(
        return_value=httpx.Response(200, json={"number": 1}),
    )
    client = GitHubClient(base_url="https://api.github.test", token="secret-token")

    try:
        payload = await client.get_pull_request("acme", "widget", 1)
    finally:
        await client.close()

    assert payload == {"number": 1}
    assert route.calls.last is not None
    assert route.calls.last.request.headers["Authorization"] == "Bearer secret-token"


@pytest.mark.asyncio
@respx.mock
async def test_pull_request_file_pagination() -> None:
    first_page = [{"filename": f"file-{index}.py"} for index in range(100)]
    second_page = [{"filename": "last.py"}]
    respx.get("https://api.github.test/repos/acme/widget/pulls/1/files").mock(
        side_effect=[
            httpx.Response(200, json=first_page),
            httpx.Response(200, json=second_page),
        ],
    )
    client = GitHubClient(base_url="https://api.github.test", token=None)

    try:
        files = await client.list_pull_request_files("acme", "widget", 1)
    finally:
        await client.close()

    assert len(files) == 101
    assert files[-1]["filename"] == "last.py"


@pytest.mark.asyncio
@respx.mock
async def test_search_pull_requests_returns_items() -> None:
    route = respx.get("https://api.github.test/search/issues").mock(
        return_value=httpx.Response(200, json={"items": [{"number": 14}]})
    )
    client = GitHubClient(base_url="https://api.github.test", token=None)

    try:
        items = await client.search_pull_requests("is:pr is:open author:octocat", limit=6)
    finally:
        await client.close()

    assert items == [{"number": 14}]
    assert route.calls.last is not None
    assert route.calls.last.request.url.params["q"] == "is:pr is:open author:octocat"
    assert route.calls.last.request.url.params["sort"] == "updated"
    assert route.calls.last.request.url.params["order"] == "desc"
    assert route.calls.last.request.url.params["per_page"] == "6"


@pytest.mark.asyncio
@respx.mock
async def test_github_validation_error_is_normalized() -> None:
    respx.post("https://api.github.test/repos/acme/widget/pulls/1/comments").mock(
        return_value=httpx.Response(422, json={"message": "Validation Failed", "errors": []}),
    )
    client = GitHubClient(base_url="https://api.github.test", token=None)

    with pytest.raises(GitHubError) as error_info:
        await client.post_pull_request_comment("acme", "widget", 1, {"body": "Nope"})

    await client.close()
    assert error_info.value.status_code == 422
    assert error_info.value.code == "github_validation_error"
    assert error_info.value.message == "Validation Failed"


def test_decode_blob_contents_rejects_binary_blob() -> None:
    payload = {
        "encoding": "base64",
        "content": base64.b64encode(b"\xff\x00PNG").decode("ascii"),
    }

    with pytest.raises(GitHubError) as error_info:
        decode_blob_contents(payload)

    assert error_info.value.status_code == 415
    assert error_info.value.code == "unsupported_binary_file"
    assert error_info.value.message == "Binary files cannot be previewed."
