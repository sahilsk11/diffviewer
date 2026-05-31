from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from diffviewer_api.models.files import FileSide


class InsightProviderName(StrEnum):
    codex = "codex"


class InsightRevision(BaseModel):
    base_sha: str = Field(validation_alias="baseSha", serialization_alias="baseSha")
    head_sha: str = Field(validation_alias="headSha", serialization_alias="headSha")

    model_config = ConfigDict(populate_by_name=True)


class FileInsight(BaseModel):
    path: str
    summary: str = Field(min_length=1)
    watch_outs: list[str] = Field(
        validation_alias="watchOuts",
        serialization_alias="watchOuts",
        min_length=1,
        max_length=6,
    )

    model_config = ConfigDict(populate_by_name=True)


class FileInsightsGenerateRequest(InsightRevision):
    pass


class FileInsightsResponse(BaseModel):
    base_sha: str = Field(serialization_alias="baseSha")
    head_sha: str = Field(serialization_alias="headSha")
    provider: InsightProviderName
    insights: list[FileInsight]

    model_config = ConfigDict(populate_by_name=True)


class CodeExplanationRequest(InsightRevision):
    path: str
    side: FileSide
    start_line: int = Field(gt=0, validation_alias="startLine", serialization_alias="startLine")
    end_line: int = Field(gt=0, validation_alias="endLine", serialization_alias="endLine")
    selected_code: str | None = Field(
        default=None,
        validation_alias="selectedCode",
        serialization_alias="selectedCode",
    )

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("selected_code")
    @classmethod
    def blank_selected_code_as_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def order_line_range(self) -> "CodeExplanationRequest":
        if self.start_line > self.end_line:
            self.start_line, self.end_line = self.end_line, self.start_line
        return self


class CodeExplanation(BaseModel):
    label: str = Field(min_length=1)
    selected_code: str | None = Field(
        default=None,
        serialization_alias="selectedCode",
    )
    text: str = Field(min_length=1)

    model_config = ConfigDict(populate_by_name=True)
