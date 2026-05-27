from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from diffviewer_api.deps import get_comment_service, get_pull_request_service
from diffviewer_api.models.comments import CommentCreate, PostedComment
from diffviewer_api.services.comment_service import CommentService
from diffviewer_api.services.pull_request_service import PullRequestService

router = APIRouter(prefix="/api/repos/{owner}/{repo}/pulls/{pull_number}", tags=["comments"])


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
    pr = await service.load(f"https://github.com/{owner}/{repo}/pull/{pull_number}")
    return await comment_service.post(owner, repo, pull_number, pr.head_sha, payload)
