import base64
from collections.abc import Mapping
from typing import Any

import httpx


class GitHubError(Exception):
    def __init__(self, message: str, *, status_code: int, code: str, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}


class GitHubClient:
    def __init__(
        self,
        *,
        base_url: str,
        token: str | None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=20.0)
        self._token = token

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @property
    def headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def get_pull_request(self, owner: str, repo: str, pull_number: int) -> dict[str, Any]:
        return await self._request("GET", f"/repos/{owner}/{repo}/pulls/{pull_number}")

    async def list_pull_request_files(
        self,
        owner: str,
        repo: str,
        pull_number: int,
    ) -> list[dict[str, Any]]:
        files: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = await self._request(
                "GET",
                f"/repos/{owner}/{repo}/pulls/{pull_number}/files",
                params={"per_page": 100, "page": page},
            )
            if not isinstance(payload, list):
                raise GitHubError(
                    "GitHub returned an unexpected pull request files response.",
                    status_code=502,
                    code="github_unexpected_response",
                )
            files.extend(payload)
            if len(payload) < 100:
                return files
            page += 1

    async def get_tree(self, owner: str, repo: str, sha: str) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/git/trees/{sha}",
            params={"recursive": "1"},
        )

    async def get_blob(self, owner: str, repo: str, sha: str) -> dict[str, Any]:
        return await self._request("GET", f"/repos/{owner}/{repo}/git/blobs/{sha}")

    async def post_pull_request_comment(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        payload: Mapping[str, Any],
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/comments",
            json=dict(payload),
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json: Mapping[str, Any] | None = None,
    ) -> Any:
        response = await self._client.request(
            method,
            path,
            headers=self.headers,
            params=params,
            json=json,
        )
        if response.is_success:
            return response.json()
        raise self._error_from_response(response)

    def _error_from_response(self, response: httpx.Response) -> GitHubError:
        details: Any
        try:
            details = response.json()
        except ValueError:
            details = {"body": response.text}

        message = "GitHub request failed."
        if isinstance(details, dict) and isinstance(details.get("message"), str):
            message = details["message"]

        code = "github_error"
        if response.status_code == 401:
            code = "github_auth_error"
        elif response.status_code == 403:
            code = "github_rate_limit_or_permission_error"
        elif response.status_code == 404:
            code = "github_not_found"
        elif response.status_code == 422:
            code = "github_validation_error"

        return GitHubError(message, status_code=response.status_code, code=code, details=details)


def decode_blob_contents(payload: Mapping[str, Any]) -> str:
    encoding = payload.get("encoding")
    content = payload.get("content")
    if encoding != "base64" or not isinstance(content, str):
        raise GitHubError(
            "GitHub returned an unsupported blob encoding.",
            status_code=502,
            code="github_unexpected_response",
        )
    compact_content = "".join(content.splitlines())
    return base64.b64decode(compact_content).decode("utf-8")
