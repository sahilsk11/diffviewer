from typing import Annotated

from fastapi import APIRouter, Depends

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


@router.get("/files", response_model=PullRequestFilesResponse)
async def get_pull_request_files(
    owner: str,
    repo: str,
    pull_number: int,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
) -> PullRequestFilesResponse:
    return PullRequestFilesResponse(files=await service.files(owner, repo, pull_number))


@router.get("/tree", response_model=RepositoryTree, response_model_by_alias=True)
async def get_tree(
    owner: str,
    repo: str,
    pull_number: int,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    file_service: Annotated[FileService, Depends(get_file_service)],
) -> RepositoryTree:
    pr = await service.load(f"https://github.com/{owner}/{repo}/pull/{pull_number}")
    return await file_service.tree(owner, repo, pr.head_sha)


@router.get("/contents", response_model=FileContents)
async def get_contents(
    owner: str,
    repo: str,
    pull_number: int,
    path: str,
    side: FileSide,
    service: Annotated[PullRequestService, Depends(get_pull_request_service)],
    file_service: Annotated[FileService, Depends(get_file_service)],
) -> FileContents:
    pr = await service.load(f"https://github.com/{owner}/{repo}/pull/{pull_number}")
    tree_sha = pr.base_sha if side == FileSide.left else pr.head_sha
    return await file_service.contents(owner, repo, tree_sha, path, side)
