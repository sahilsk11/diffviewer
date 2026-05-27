from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from diffviewer_api.config import Settings, get_settings
from diffviewer_api.routes import comments, files, health, pull_requests, review_state
from diffviewer_api.services.file_service import FileService
from diffviewer_api.services.github_client import GitHubClient, GitHubError
from diffviewer_api.services.pull_request_service import PullRequestService
from diffviewer_api.services.read_state_store import ReadStateStore
from diffviewer_api.storage.sqlite import connect


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        github_client = GitHubClient(
            base_url=resolved_settings.github_api_base_url,
            token=resolved_settings.github_token,
        )
        db_connection = connect(resolved_settings.db_path)
        app.state.github_client = github_client
        app.state.db_connection = db_connection
        app.state.file_service = FileService(github_client)
        app.state.pull_request_service = PullRequestService(
            github_client,
            ReadStateStore(db_connection),
        )
        try:
            yield
        finally:
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
    app.include_router(review_state.router)
    app.include_router(comments.router)

    static_dir = Path(__file__).resolve().parents[3] / "dist"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

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
