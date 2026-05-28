from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from diffviewer_api.deps import get_file_service, get_pull_request_service
from diffviewer_api.models.files import (
    FileContents,
    FileSide,
    PullRequestFilesResponse,
    RepositoryTree,
)
from diffviewer_api.services.file_service import FileService
from diffviewer_api.services.pull_request_service import PullRequestService

router = APIRouter(prefix="/api/repos/{owner}/{repo}/pulls/{pull_number}", tags=["files"])


def stale_pull_request_error(
    *,
    current_base_sha: str,
    current_head_sha: str,
    expected_base_sha: str,
    expected_head_sha: str,
) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "error": "Pull request changed. Refresh before viewing files.",
            "code": "stale_pull_request",
            "currentBaseSha": current_base_sha,
            "currentHeadSha": current_head_sha,
            "expectedBaseSha": expected_base_sha,
            "expectedHeadSha": expected_head_sha,
        },
    )


async def load_matching_pull_request(
    *,
    owner: str,
    repo: str,
    pull_number: int,
    expected_base_sha: str,
    expected_head_sha: str,
    service: PullRequestService,
):
    pr = await service.revision(owner, repo, pull_number, force_refresh=True)
    if pr.base_sha != expected_base_sha or pr.head_sha != expected_head_sha:
        raise stale_pull_request_error(
            current_base_sha=pr.base_sha,
            current_head_sha=pr.head_sha,
            expected_base_sha=expected_base_sha,
            expected_head_sha=expected_head_sha,
        )
    return pr


@router.get("/files", response_model=PullRequestFilesResponse)
async def get_pull_request_files(
    owner: str,
    repo: str,
    pull_number: int,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    head_sha: Annotated[str | None, Query(alias="headSha")] = None,
) -> PullRequestFilesResponse:
    if head_sha is not None:
        pr = await service.revision(owner, repo, pull_number, force_refresh=True)
        if pr.head_sha != head_sha:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "Pull request changed. Refresh before viewing files.",
                    "code": "stale_pull_request",
                    "currentHeadSha": pr.head_sha,
                    "expectedHeadSha": head_sha,
                },
            )
    return PullRequestFilesResponse(files=await service.files(owner, repo, pull_number))


@router.get("/tree", response_model=RepositoryTree, response_model_by_alias=True)
async def get_tree(
    owner: str,
    repo: str,
    pull_number: int,
    head_sha: Annotated[str, Query(alias="headSha")],
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    file_service: Annotated[FileService, Depends(get_file_service)],
) -> RepositoryTree:
    pr = await service.revision(owner, repo, pull_number, force_refresh=True)
    if pr.head_sha != head_sha:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "Pull request changed. Refresh before viewing files.",
                "code": "stale_pull_request",
                "currentHeadSha": pr.head_sha,
                "expectedHeadSha": head_sha,
            },
        )
    return await file_service.tree(owner, repo, head_sha)


@router.get("/contents", response_model=FileContents)
async def get_contents(
    owner: str,
    repo: str,
    pull_number: int,
    path: str,
    side: FileSide,
    base_sha: Annotated[str, Query(alias="baseSha")],
    head_sha: Annotated[str, Query(alias="headSha")],
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    file_service: Annotated[FileService, Depends(get_file_service)],
) -> FileContents:
    await load_matching_pull_request(
        owner=owner,
        repo=repo,
        pull_number=pull_number,
        expected_base_sha=base_sha,
        expected_head_sha=head_sha,
        service=service,
    )
    tree_sha = base_sha if side == FileSide.left else head_sha
    return await file_service.contents(owner, repo, tree_sha, path, side)
