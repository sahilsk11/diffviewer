from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from diffviewer_api.models.files import PullRequestFile
from diffviewer_api.models.state import ReadState


class PullRequestLoad(BaseModel):
    url: HttpUrl


class PullRequestRef(BaseModel):
    owner: str
    repo: str
    pull_number: int = Field(serialization_alias="pullNumber")

    model_config = ConfigDict(populate_by_name=True)


class PullRequestResponse(BaseModel):
    ref: PullRequestRef
    title: str
    html_url: str = Field(serialization_alias="htmlUrl")
    base_sha: str = Field(serialization_alias="baseSha")
    head_sha: str = Field(serialization_alias="headSha")
    head_ref: str = Field(serialization_alias="headRef")
    author: str
    files: list[PullRequestFile]
    read_state: ReadState = Field(serialization_alias="readState")

    model_config = ConfigDict(populate_by_name=True)


class PullRequestRecommendation(BaseModel):
    ref: PullRequestRef
    title: str
    html_url: str = Field(serialization_alias="htmlUrl")
    author: str
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class PullRequestRecommendationsResponse(BaseModel):
    recommendations: list[PullRequestRecommendation]
