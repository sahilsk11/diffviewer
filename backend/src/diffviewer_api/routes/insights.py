from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from diffviewer_api.deps import get_insight_service
from diffviewer_api.models.insights import (
    CodeExplanation,
    CodeExplanationRequest,
    FileInsightsGenerateRequest,
    FileInsightsResponse,
)
from diffviewer_api.services.insight_service import InsightService, StalePullRequestRevisionError

router = APIRouter(prefix="/api/repos/{owner}/{repo}/pulls/{pull_number}", tags=["insights"])


def stale_pull_request_error(error: StalePullRequestRevisionError) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "error": "Pull request changed. Refresh before generating insights.",
            "code": "stale_pull_request",
            "currentBaseSha": error.current_base_sha,
            "currentHeadSha": error.current_head_sha,
            "expectedBaseSha": error.expected_base_sha,
            "expectedHeadSha": error.expected_head_sha,
        },
    )


@router.post("/insights/files", response_model=FileInsightsResponse, response_model_by_alias=True)
async def generate_file_insights(
    owner: str,
    repo: str,
    pull_number: int,
    payload: FileInsightsGenerateRequest,
    service: Annotated[InsightService, Depends(get_insight_service)],
) -> FileInsightsResponse:
    try:
        return await service.file_insights(owner, repo, pull_number, payload)
    except StalePullRequestRevisionError as error:
        raise stale_pull_request_error(error) from error


@router.post("/insights/explain", response_model=CodeExplanation, response_model_by_alias=True)
async def explain_code(
    owner: str,
    repo: str,
    pull_number: int,
    payload: CodeExplanationRequest,
    service: Annotated[InsightService, Depends(get_insight_service)],
) -> CodeExplanation:
    try:
        return await service.explain_code(owner, repo, pull_number, payload)
    except StalePullRequestRevisionError as error:
        raise stale_pull_request_error(error) from error
