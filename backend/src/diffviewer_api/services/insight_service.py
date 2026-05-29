import asyncio
import hashlib
from dataclasses import dataclass

from diffviewer_api.models.files import FileSide
from diffviewer_api.models.insights import (
    CodeExplanation,
    CodeExplanationRequest,
    FileInsight,
    FileInsightsGenerateRequest,
    FileInsightsResponse,
)
from diffviewer_api.services.file_service import FileService
from diffviewer_api.services.insight_provider import ExplanationPayload, InsightProvider
from diffviewer_api.services.pull_request_service import PullRequestService


@dataclass(frozen=True)
class InsightRevisionKey:
    owner: str
    repo: str
    pull_number: int
    base_sha: str
    head_sha: str


@dataclass(frozen=True)
class ExplanationCacheKey(InsightRevisionKey):
    path: str
    side: FileSide
    start_line: int
    end_line: int
    selected_code_hash: str


@dataclass(frozen=True)
class StalePullRequestRevisionError(Exception):
    current_base_sha: str
    current_head_sha: str
    expected_base_sha: str
    expected_head_sha: str


class InsightService:
    def __init__(
        self,
        *,
        pull_requests: PullRequestService,
        files: FileService,
        provider: InsightProvider,
    ) -> None:
        self._pull_requests = pull_requests
        self._files = files
        self._provider = provider
        self._file_insight_cache: dict[InsightRevisionKey, list[FileInsight]] = {}
        self._explanation_cache: dict[ExplanationCacheKey, CodeExplanation] = {}

    async def file_insights(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        request: FileInsightsGenerateRequest,
    ) -> FileInsightsResponse:
        key = await self._validated_revision_key(owner, repo, pull_number, request)
        cached = self._file_insight_cache.get(key)
        if cached is None:
            changed_files = await self._pull_requests.files(
                owner,
                repo,
                pull_number,
                force_refresh=True,
            )
            cached = list(
                await asyncio.gather(
                    *(self._provider.file_insight(file) for file in changed_files),
                )
            )
            self._file_insight_cache[key] = cached

        return FileInsightsResponse(
            base_sha=key.base_sha,
            head_sha=key.head_sha,
            provider=self._provider.name,
            insights=cached,
        )

    async def explain_code(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        request: CodeExplanationRequest,
    ) -> CodeExplanation:
        revision_key = await self._validated_revision_key(owner, repo, pull_number, request)
        selected_code = request.selected_code
        if selected_code is None:
            selected_code = await self._selected_code(owner, repo, request)

        key = ExplanationCacheKey(
            owner=revision_key.owner,
            repo=revision_key.repo,
            pull_number=revision_key.pull_number,
            base_sha=revision_key.base_sha,
            head_sha=revision_key.head_sha,
            path=request.path,
            side=request.side,
            start_line=request.start_line,
            end_line=request.end_line,
            selected_code_hash=_code_hash(selected_code),
        )
        cached = self._explanation_cache.get(key)
        if cached is not None:
            return cached

        explanation = await self._provider.code_explanation(
            ExplanationPayload(
                path=request.path,
                side=request.side.value,
                start_line=request.start_line,
                end_line=request.end_line,
                selected_code=selected_code,
            ),
        )
        self._explanation_cache[key] = explanation
        return explanation

    async def _validated_revision_key(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        request: FileInsightsGenerateRequest | CodeExplanationRequest,
    ) -> InsightRevisionKey:
        current = await self._pull_requests.revision(owner, repo, pull_number, force_refresh=True)
        if current.base_sha != request.base_sha or current.head_sha != request.head_sha:
            raise StalePullRequestRevisionError(
                current_base_sha=current.base_sha,
                current_head_sha=current.head_sha,
                expected_base_sha=request.base_sha,
                expected_head_sha=request.head_sha,
            )
        return InsightRevisionKey(
            owner=owner,
            repo=repo,
            pull_number=pull_number,
            base_sha=request.base_sha,
            head_sha=request.head_sha,
        )

    async def _selected_code(
        self,
        owner: str,
        repo: str,
        request: CodeExplanationRequest,
    ) -> str | None:
        tree_sha = request.base_sha if request.side == FileSide.left else request.head_sha
        contents = await self._files.contents(owner, repo, tree_sha, request.path, request.side)
        lines = contents.contents.splitlines()
        selected = lines[request.start_line - 1 : request.end_line]
        return "\n".join(selected).strip() or None


def _code_hash(selected_code: str | None) -> str:
    if selected_code is None:
        return "none"
    return hashlib.sha256(selected_code.encode("utf-8")).hexdigest()
