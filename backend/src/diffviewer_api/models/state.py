from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class FileReviewState(StrEnum):
    approved = "approved"
    flagged = "flagged"
    skipped = "skipped"
    unreviewed = "unreviewed"


class ReadState(BaseModel):
    approved: list[str] = Field(default_factory=list)
    flagged: list[str] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)


class StateUpdate(BaseModel):
    path: str
    state: FileReviewState


class StateUpdateResult(BaseModel):
    path: str
    state: FileReviewState
    updated_at: datetime = Field(serialization_alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
