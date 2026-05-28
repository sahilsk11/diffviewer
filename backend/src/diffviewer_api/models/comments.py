from pydantic import BaseModel, ConfigDict, Field

from diffviewer_api.models.files import FileSide


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)
    path: str
    line: int = Field(gt=0)
    side: FileSide
    head_sha: str = Field(validation_alias="headSha")
    start_line: int | None = Field(default=None, gt=0, validation_alias="startLine")
    start_side: FileSide | None = Field(default=None, validation_alias="startSide")

    model_config = ConfigDict(populate_by_name=True)


class PostedComment(BaseModel):
    id: int
    html_url: str = Field(serialization_alias="htmlUrl")
    path: str
    line: int
    side: FileSide
    body: str

    model_config = ConfigDict(populate_by_name=True)
