import asyncio
import json
import shutil
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

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

FILE_INSIGHTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "insights": {
            "type": "array",
            "items": FILE_INSIGHT_SCHEMA,
        },
    },
    "required": ["insights"],
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


class InsightGenerationError(Exception):
    def __init__(self, message: str, *, code: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


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

    async def file_insights(self, files: Sequence[PullRequestFile]) -> list[FileInsight]:
        raise NotImplementedError

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        raise NotImplementedError

    async def close(self) -> None:
        raise NotImplementedError


class CodexCliInsightProvider:
    def __init__(
        self,
        *,
        command: str = "codex",
        model: str | None = None,
        timeout_seconds: float = 120.0,
        workdir: Path | None = None,
    ) -> None:
        self._command = command
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._workdir = workdir or Path.cwd()

    @property
    def name(self) -> InsightProviderName:
        return InsightProviderName.codex

    async def close(self) -> None:
        return None

    async def file_insights(self, files: Sequence[PullRequestFile]) -> list[FileInsight]:
        payload = [
            FileInsightPayload(
                path=file.path,
                status=file.status,
                additions=file.additions,
                deletions=file.deletions,
                changes=file.changes,
                patch=file.patch,
            ).model_dump()
            for file in files
        ]
        data = await self._structured_response(
            schema=FILE_INSIGHTS_SCHEMA,
            prompt=(
                "Generate concise pull request review insights as JSON for each changed file.\n"
                "Return exactly one insight per input file, preserving each path.\n"
                "Be specific to the supplied diff metadata and patch. Do not use generic advice.\n"
                "Do not invent behavior not evidenced by the patch.\n\n"
                f"Changed files JSON:\n{json.dumps(payload, separators=(',', ':'))}"
            ),
        )

        try:
            insights = [FileInsight.model_validate(item) for item in data["insights"]]
        except (KeyError, TypeError, ValidationError) as error:
            raise InsightGenerationError(
                "Codex returned invalid file insights.",
                code="codex_invalid_response",
            ) from error

        by_path = {insight.path: insight for insight in insights}
        missing_paths = [file.path for file in files if file.path not in by_path]
        if missing_paths:
            raise InsightGenerationError(
                "Codex did not return insights for every changed file.",
                code="codex_incomplete_response",
            )
        return [by_path[file.path] for file in files]

    async def code_explanation(self, payload: ExplanationPayload) -> CodeExplanation:
        data = await self._structured_response(
            schema=CODE_EXPLANATION_SCHEMA,
            prompt=(
                "Explain selected pull request code for a reviewer as JSON.\n"
                "Ground the answer in the supplied file, side, range, and selected code only.\n"
                "Be concise and specific.\n\n"
                f"Selection JSON:\n{payload.model_dump_json(by_alias=True)}"
            ),
        )
        try:
            explanation = CodeExplanation.model_validate(data)
        except ValidationError as error:
            raise InsightGenerationError(
                "Codex returned an invalid code explanation.",
                code="codex_invalid_response",
            ) from error
        return explanation.model_copy(update={"selected_code": payload.selected_code})

    async def _structured_response(self, *, schema: dict[str, Any], prompt: str) -> Any:
        if shutil.which(self._command) is None:
            raise InsightGenerationError(
                "Codex CLI is not installed or is not on PATH.",
                code="codex_unavailable",
                status_code=503,
            )

        with tempfile.TemporaryDirectory(prefix="diffviewer-codex-") as directory:
            schema_path = Path(directory) / "schema.json"
            output_path = Path(directory) / "output.json"
            schema_path.write_text(json.dumps(schema), encoding="utf-8")
            command = [
                self._command,
                "-a",
                "never",
                "exec",
                "--ephemeral",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--output-schema",
                str(schema_path),
                "-o",
                str(output_path),
            ]
            if self._model:
                command.extend(["--model", self._model])
            command.append(prompt)

            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=self._workdir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self._timeout_seconds,
                )
            except TimeoutError as error:
                process.kill()
                await process.communicate()
                raise InsightGenerationError(
                    "Codex timed out while generating insights.",
                    code="codex_timeout",
                    status_code=504,
                ) from error

            if process.returncode != 0:
                details = _process_output(stderr) or _process_output(stdout)
                message = "Codex failed to generate insights."
                if details:
                    message = f"{message} {details}"
                raise InsightGenerationError(message, code="codex_failed")

            try:
                return json.loads(output_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise InsightGenerationError(
                    "Codex did not write valid structured output.",
                    code="codex_invalid_response",
                ) from error


def _process_output(value: bytes) -> str:
    return value.decode("utf-8", errors="replace").strip().splitlines()[-1] if value else ""
