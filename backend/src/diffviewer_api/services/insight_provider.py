import json
from collections.abc import Mapping, Sequence
from typing import Any, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field

from diffviewer_api.models.files import PullRequestFile
from diffviewer_api.models.insights import CodeExplanation, FileInsight, InsightProviderName

FILE_INSIGHT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "path": {"type": "string"},
        "summary": {"type": "string"},
        "watchOuts": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {"type": "string"},
        },
    },
    "required": ["path", "summary", "watchOuts"],
}

CODE_EXPLANATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "label": {"type": "string"},
        "selectedCode": {"type": ["string", "null"]},
        "text": {"type": "string"},
    },
    "required": ["label", "selectedCode", "text"],
}


class FileInsightPayload(BaseModel):
    path: str
    status: str
    additions: int
    deletions: int
    changes: int
    patch: str | None


class ExplanationPayload(BaseModel):
    path: str
    side: str
    start_line: int = Field(serialization_alias="startLine")
    end_line: int = Field(serialization_alias="endLine")
    selected_code: str | None = Field(default=None, serialization_alias="selectedCode")

    model_config = ConfigDict(populate_by_name=True)


class InsightProvider(Protocol):
    @property
    def name(self) -> InsightProviderName:
        raise NotImplementedError

    async def file_insight(self, file: PullRequestFile) -> FileInsight:
        raise NotImplementedError

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        raise NotImplementedError

    async def close(self) -> None:
        raise NotImplementedError


class LocalInsightProvider:
    @property
    def name(self) -> InsightProviderName:
        return InsightProviderName.local

    async def file_insight(self, file: PullRequestFile) -> FileInsight:
        summary = (
            f"{file.path} is a {file.status} file with {file.changes} changed lines: "
            f"{file.additions} additions and {file.deletions} deletions."
        )
        return FileInsight(
            path=file.path,
            summary=summary,
            watch_outs=[
                f"Review the {file.status} file path and change shape.",
                "Check whether neighboring files need matching updates.",
                "Verify the changed behavior is covered by focused tests.",
            ],
        )

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        line_label = (
            f"line {payload.start_line}"
            if payload.start_line == payload.end_line
            else f"lines {payload.start_line}-{payload.end_line}"
        )
        text = (
            f"This selection covers {line_label} on {payload.side} in {payload.path}. "
            "Read it against the surrounding diff to confirm the behavior change and any "
            "related tests or call sites."
        )
        return CodeExplanation(
            label=f"{payload.path} {line_label}",
            selected_code=payload.selected_code,
            text=text,
        )

    async def close(self) -> None:
        return None


class OpenAIInsightProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=45.0)

    @property
    def name(self) -> InsightProviderName:
        return InsightProviderName.openai

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def file_insight(self, file: PullRequestFile) -> FileInsight:
        payload = FileInsightPayload(
            path=file.path,
            status=file.status,
            additions=file.additions,
            deletions=file.deletions,
            changes=file.changes,
            patch=file.patch,
        )
        data = await self._structured_response(
            name="file_insight",
            schema=FILE_INSIGHT_SCHEMA,
            input_messages=[
                {
                    "role": "system",
                    "content": (
                        "Generate concise pull request review insight JSON. "
                        "Be specific to the supplied diff metadata and patch. "
                        "Do not invent behavior not evidenced by the patch."
                    ),
                },
                {"role": "user", "content": payload.model_dump_json()},
            ],
        )
        insight = FileInsight.model_validate(data)
        if insight.path != file.path:
            return insight.model_copy(update={"path": file.path})
        return insight

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        data = await self._structured_response(
            name="code_explanation",
            schema=CODE_EXPLANATION_SCHEMA,
            input_messages=[
                {
                    "role": "system",
                    "content": (
                        "Explain the selected pull request code for a reviewer. "
                        "Return concise JSON. Ground the answer in the supplied file, "
                        "side, range, and selected code only."
                    ),
                },
                {"role": "user", "content": payload.model_dump_json(by_alias=True)},
            ],
        )
        explanation = CodeExplanation.model_validate(data)
        return explanation.model_copy(update={"selected_code": payload.selected_code})

    async def _structured_response(
        self,
        *,
        name: str,
        schema: Mapping[str, Any],
        input_messages: Sequence[Mapping[str, str]],
    ) -> Any:
        response = await self._client.post(
            "/responses",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "input": list(input_messages),
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": name,
                        "strict": True,
                        "schema": schema,
                    },
                },
            },
        )
        response.raise_for_status()
        return json.loads(_extract_response_text(response.json()))


def _extract_response_text(payload: Mapping[str, Any]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str):
        return output_text

    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, Mapping):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, Mapping):
                    continue
                text = part.get("text")
                if isinstance(text, str):
                    return text

    raise ValueError("OpenAI response did not include structured output text.")
