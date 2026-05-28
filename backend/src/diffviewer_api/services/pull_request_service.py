import re
from dataclasses import dataclass
from typing import Any

from diffviewer_api.models.files import PullRequestFile
from diffviewer_api.models.github import PullRequestRef, PullRequestResponse
from diffviewer_api.services.github_client import GitHubClient
from diffviewer_api.services.read_state_store import ReadStateStore

PR_URL_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/pull/([0-9]+)/?$")


@dataclass(frozen=True)
class ParsedPullRequestUrl:
    owner: str
    repo: str
    pull_number: int


@dataclass(frozen=True)
class PullRequestRevision:
    base_sha: str
    head_sha: str


class PullRequestUrlError(ValueError):
    pass


def parse_pull_request_url(url: str) -> ParsedPullRequestUrl:
    match = PR_URL_RE.match(url)
    if match is None:
        raise PullRequestUrlError("Expected a GitHub pull request URL.")
    owner, repo, pull_number = match.groups()
    return ParsedPullRequestUrl(owner=owner, repo=repo, pull_number=int(pull_number))


def map_pull_request_file(payload: dict[str, Any]) -> PullRequestFile:
    return PullRequestFile(
        path=payload["filename"],
        status=payload["status"],
        additions=payload["additions"],
        deletions=payload["deletions"],
        changes=payload["changes"],
        patch=payload.get("patch"),
    )


class PullRequestService:
    def __init__(self, github: GitHubClient, read_state_store: ReadStateStore) -> None:
        self._github = github
        self._read_state_store = read_state_store
        self._pull_request_cache: dict[str, dict[str, Any]] = {}
        self._files_cache: dict[str, list[dict[str, Any]]] = {}

    async def load(self, url: str, *, force_refresh: bool = False) -> PullRequestResponse:
        ref = parse_pull_request_url(url)
        cache_key = self._cache_key(ref.owner, ref.repo, ref.pull_number)
        pr_payload = await self._pull_request(ref.owner, ref.repo, ref.pull_number, force_refresh)
        file_payloads = await self._files(ref.owner, ref.repo, ref.pull_number, force_refresh)
        self._pull_request_cache[cache_key] = pr_payload
        self._files_cache[cache_key] = file_payloads
        files = [map_pull_request_file(file_payload) for file_payload in file_payloads]
        read_state = self._read_state_store.get(ref.owner, ref.repo, ref.pull_number)

        return PullRequestResponse(
            ref=PullRequestRef(owner=ref.owner, repo=ref.repo, pull_number=ref.pull_number),
            title=pr_payload["title"],
            html_url=pr_payload["html_url"],
            base_sha=pr_payload["base"]["sha"],
            head_sha=pr_payload["head"]["sha"],
            head_ref=pr_payload["head"]["ref"],
            author=pr_payload["user"]["login"],
            files=files,
            read_state=read_state,
        )

    async def files(self, owner: str, repo: str, pull_number: int) -> list[PullRequestFile]:
        file_payloads = await self._files(owner, repo, pull_number)
        return [map_pull_request_file(file_payload) for file_payload in file_payloads]

    async def revision(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        *,
        force_refresh: bool = False,
    ) -> PullRequestRevision:
        pr_payload = await self._pull_request(owner, repo, pull_number, force_refresh)
        return PullRequestRevision(
            base_sha=pr_payload["base"]["sha"],
            head_sha=pr_payload["head"]["sha"],
        )

    async def _pull_request(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        cache_key = self._cache_key(owner, repo, pull_number)
        if not force_refresh and cache_key in self._pull_request_cache:
            return self._pull_request_cache[cache_key]

        payload = await self._github.get_pull_request(owner, repo, pull_number)
        self._pull_request_cache[cache_key] = payload
        return payload

    async def _files(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        force_refresh: bool = False,
    ) -> list[dict[str, Any]]:
        cache_key = self._cache_key(owner, repo, pull_number)
        if not force_refresh and cache_key in self._files_cache:
            return self._files_cache[cache_key]

        payload = await self._github.list_pull_request_files(owner, repo, pull_number)
        self._files_cache[cache_key] = payload
        return payload

    @staticmethod
    def _cache_key(owner: str, repo: str, pull_number: int) -> str:
        return f"{owner}/{repo}#{pull_number}"
