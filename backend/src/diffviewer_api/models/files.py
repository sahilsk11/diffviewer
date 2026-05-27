from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class FileSide(StrEnum):
    left = "LEFT"
    right = "RIGHT"


class PullRequestFile(BaseModel):
    path: str
    status: str
    additions: int
    deletions: int
    changes: int
    patch: str | None = None


class PullRequestFilesResponse(BaseModel):
    files: list[PullRequestFile]


class TreeEntry(BaseModel):
    path: str
    type: str
    sha: str
    size: int | None = None


class RepositoryTree(BaseModel):
    head_sha: str = Field(serialization_alias="headSha")
    truncated: bool
    entries: list[TreeEntry]

    model_config = ConfigDict(populate_by_name=True)


class FileContents(BaseModel):
    path: str
    side: FileSide
    sha: str
    contents: str
