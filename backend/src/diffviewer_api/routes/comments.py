from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from diffviewer_api.deps import get_comment_service, get_pull_request_service
from diffviewer_api.models.comments import CommentCreate, PostedComment
from diffviewer_api.services.comment_service import CommentService
from diffviewer_api.services.pull_request_service import PullRequestService

router = APIRouter(prefix="/api/repos/{owner}/{repo}/pulls/{pull_number}", tags=["comments"])


def stale_pull_request_error(*, current_head_sha: str, expected_head_sha: str) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "error": "Pull request changed. Refresh before commenting.",
            "code": "stale_pull_request",
            "currentHeadSha": current_head_sha,
            "expectedHeadSha": expected_head_sha,
        },
    )


@router.post("/comments", response_model=PostedComment, response_model_by_alias=True)
async def post_comment(
    owner: str,
    repo: str,
    pull_number: int,
    payload: CommentCreate,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    comment_service: Annotated[CommentService, Depends(get_comment_service)],
) -> PostedComment:
    if not payload.body.strip():
        raise HTTPException(
            status_code=422,
            detail={"error": "Comment body must not be empty.", "code": "validation_error"},
        )
    pr = await service.revision(owner, repo, pull_number, force_refresh=True)
    if pr.head_sha != payload.head_sha:
        raise stale_pull_request_error(
            current_head_sha=pr.head_sha,
            expected_head_sha=payload.head_sha,
        )
    return await comment_service.post(owner, repo, pull_number, payload.head_sha, payload)
