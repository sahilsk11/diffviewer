from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.types import Scope

from diffviewer_api.config import Settings, get_settings
from diffviewer_api.routes import comments, files, health, insights, pull_requests, review_state
from diffviewer_api.services.file_service import FileService
from diffviewer_api.services.github_client import GitHubClient, GitHubError
from diffviewer_api.services.insight_provider import CodexCliInsightProvider, InsightProvider
from diffviewer_api.services.insight_service import InsightService
from diffviewer_api.services.pull_request_recommendation_service import (
    PullRequestRecommendationService,
)
from diffviewer_api.services.pull_request_service import PullRequestService
from diffviewer_api.services.read_state_store import ReadStateStore
from diffviewer_api.storage.sqlite import connect

DEFAULT_STATIC_DIR = Path(__file__).resolve().parents[3] / "dist"


class SinglePageAppStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or path.startswith("api/"):
                raise
            return await super().get_response("index.html", scope)


def create_app(
    settings: Settings | None = None,
    insight_provider: InsightProvider | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        github_client = GitHubClient(
            base_url=resolved_settings.github_api_base_url,
            tokens=resolved_settings.github_tokens,
        )
        db_connection = connect(resolved_settings.db_path)
        app.state.github_client = github_client
        app.state.db_connection = db_connection
        app.state.file_service = FileService(github_client)
        app.state.pull_request_service = PullRequestService(
            github_client,
            ReadStateStore(db_connection),
        )
        app.state.pull_request_recommendation_service = PullRequestRecommendationService(
            github_client,
        )
        resolved_insight_provider = insight_provider or CodexCliInsightProvider(
            command=resolved_settings.codex_cli_command,
            model=resolved_settings.codex_model,
            timeout_seconds=resolved_settings.codex_timeout_seconds,
        )
        app.state.insight_provider = resolved_insight_provider
        app.state.insight_service = InsightService(
            pull_requests=app.state.pull_request_service,
            files=app.state.file_service,
            provider=resolved_insight_provider,
        )
        try:
            yield
        finally:
            await resolved_insight_provider.close()
            await github_client.close()
            db_connection.close()

    app = FastAPI(title="Diffviewer API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.diffviewer_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(pull_requests.router)
    app.include_router(files.router)
    app.include_router(insights.router)
    app.include_router(review_state.router)
    app.include_router(comments.router)

    static_dir = DEFAULT_STATIC_DIR
    if static_dir.exists():
        app.mount("/", SinglePageAppStaticFiles(directory=static_dir, html=True), name="static")

    @app.exception_handler(GitHubError)
    async def github_error_handler(  # pyright: ignore[reportUnusedFunction]
        _request: Request,
        error: GitHubError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code if error.status_code < 500 else 502,
            content={"error": error.message, "code": error.code, "details": error.details},
        )

    return app
