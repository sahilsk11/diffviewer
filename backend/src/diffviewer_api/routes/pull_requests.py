from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from diffviewer_api.deps import get_pull_request_service
from diffviewer_api.models.github import PullRequestLoad, PullRequestResponse
from diffviewer_api.services.pull_request_service import (
    PullRequestService,
    PullRequestUrlError,
)

router = APIRouter(prefix="/api/pull-requests", tags=["pull-requests"])


@router.post("/load", response_model=PullRequestResponse, response_model_by_alias=True)
async def load_pull_request(
    payload: PullRequestLoad,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
) -> PullRequestResponse:
    try:
        return await service.load(str(payload.url))
    except PullRequestUrlError as error:
        raise HTTPException(
            status_code=400,
            detail={"error": str(error), "code": "invalid_pr_url"},
        ) from error
