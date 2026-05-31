import asyncio
from collections.abc import Sequence

import pytest

from diffviewer_api.models.files import FileContents, FileSide, PullRequestFile
from diffviewer_api.models.insights import (
    CodeExplanation,
    CodeExplanationRequest,
    FileInsight,
    FileInsightsGenerateRequest,
    InsightProviderName,
)
from diffviewer_api.services.insight_provider import ExplanationPayload
from diffviewer_api.services.insight_service import InsightService, StalePullRequestRevisionError
from diffviewer_api.services.pull_request_service import PullRequestRevision


class FakePullRequests:
    def __init__(self) -> None:
        self.file_calls = 0
        self.revision_value = PullRequestRevision(base_sha="base_sha", head_sha="head_sha")

    async def revision(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        *,
        force_refresh: bool = False,
    ) -> PullRequestRevision:
        return self.revision_value

    async def files(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        *,
        force_refresh: bool = False,
    ) -> list[PullRequestFile]:
        self.file_calls += 1
        return [
            PullRequestFile(
                path="src/first.ts",
                status="modified",
                additions=1,
                deletions=1,
                changes=2,
                patch="@@ first",
            ),
            PullRequestFile(
                path="src/second.ts",
                status="modified",
                additions=2,
                deletions=1,
                changes=3,
                patch="@@ second",
            ),
        ]


class FakeFiles:
    async def contents(
        self,
        owner: str,
        repo: str,
        head_sha: str,
        path: str,
        side: FileSide,
    ) -> FileContents:
        return FileContents(
            path=path,
            side=side,
            sha=f"{head_sha}:blob",
            contents="one\ntwo\nthree\nfour",
        )


class FakeProvider:
    @property
    def name(self) -> InsightProviderName:
        return InsightProviderName.codex

    async def file_insights(self, files: Sequence[PullRequestFile]) -> list[FileInsight]:
        return [
            FileInsight(
                path=file.path,
                summary=f"Generated summary for {file.path}.",
                watch_outs=[f"Review {file.path}."],
            )
            for file in files
        ]

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        return CodeExplanation(
            label=f"{payload.path} lines {payload.start_line}-{payload.end_line}",
            selected_code=payload.selected_code,
            text=f"Generated explanation for {payload.path}.",
        )

    async def close(self) -> None:
        return None


class SlowProvider(FakeProvider):
    def __init__(self) -> None:
        self.max_in_flight = 0
        self._in_flight = 0

    async def file_insights(self, files: Sequence[PullRequestFile]) -> list[FileInsight]:
        self._in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self._in_flight)
        await asyncio.sleep(0.01)
        try:
            return await super().file_insights(files)
        finally:
            self._in_flight -= 1


@pytest.mark.asyncio
async def test_file_insights_generate_batch_and_reuse_cache() -> None:
    pull_requests = FakePullRequests()
    provider = SlowProvider()
    service = InsightService(
        pull_requests=pull_requests,  # pyright: ignore[reportArgumentType]
        files=FakeFiles(),  # pyright: ignore[reportArgumentType]
        provider=provider,
    )

    first = await service.file_insights(
        "OWNER",
        "REPO",
        123,
        FileInsightsGenerateRequest(base_sha="base_sha", head_sha="head_sha"),
    )
    second = await service.file_insights(
        "OWNER",
        "REPO",
        123,
        FileInsightsGenerateRequest(base_sha="base_sha", head_sha="head_sha"),
    )

    assert [insight.path for insight in first.insights] == ["src/first.ts", "src/second.ts"]
    assert second.insights == first.insights
    assert pull_requests.file_calls == 1
    assert provider.max_in_flight == 1


@pytest.mark.asyncio
async def test_explain_code_reads_selected_lines_when_not_provided() -> None:
    service = InsightService(
        pull_requests=FakePullRequests(),  # pyright: ignore[reportArgumentType]
        files=FakeFiles(),  # pyright: ignore[reportArgumentType]
        provider=FakeProvider(),
    )

    explanation = await service.explain_code(
        "OWNER",
        "REPO",
        123,
        CodeExplanationRequest(
            base_sha="base_sha",
            head_sha="head_sha",
            path="src/example.ts",
            side=FileSide.right,
            start_line=2,
            end_line=3,
        ),
    )

    assert explanation.selected_code == "two\nthree"


@pytest.mark.asyncio
async def test_insights_reject_stale_revision() -> None:
    pull_requests = FakePullRequests()
    pull_requests.revision_value = PullRequestRevision(base_sha="new_base", head_sha="new_head")
    service = InsightService(
        pull_requests=pull_requests,  # pyright: ignore[reportArgumentType]
        files=FakeFiles(),  # pyright: ignore[reportArgumentType]
        provider=FakeProvider(),
    )

    with pytest.raises(StalePullRequestRevisionError) as error_info:
        await service.file_insights(
            "OWNER",
            "REPO",
            123,
            FileInsightsGenerateRequest(base_sha="old_base", head_sha="old_head"),
        )

    assert error_info.value.current_base_sha == "new_base"
    assert error_info.value.current_head_sha == "new_head"
