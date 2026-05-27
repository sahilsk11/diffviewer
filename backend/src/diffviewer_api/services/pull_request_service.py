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

    async def load(self, url: str) -> PullRequestResponse:
        ref = parse_pull_request_url(url)
        pr_payload = await self._github.get_pull_request(ref.owner, ref.repo, ref.pull_number)
        file_payloads = await self._github.list_pull_request_files(
            ref.owner,
            ref.repo,
            ref.pull_number,
        )
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
        file_payloads = await self._github.list_pull_request_files(owner, repo, pull_number)
        return [map_pull_request_file(file_payload) for file_payload in file_payloads]
