import sqlite3
from collections.abc import AsyncIterator, Iterator

from fastapi import Request

from diffviewer_api.services.comment_service import CommentService
from diffviewer_api.services.file_service import FileService
from diffviewer_api.services.github_client import GitHubClient
from diffviewer_api.services.pull_request_service import PullRequestService
from diffviewer_api.services.read_state_store import ReadStateStore


def get_github_client(request: Request) -> GitHubClient:
    return request.app.state.github_client


def get_db_connection(request: Request) -> sqlite3.Connection:
    return request.app.state.db_connection


def get_read_state_store(request: Request) -> ReadStateStore:
    return ReadStateStore(get_db_connection(request))


def get_pull_request_service(request: Request) -> PullRequestService:
    return request.app.state.pull_request_service


def get_file_service(request: Request) -> FileService:
    return request.app.state.file_service


def get_comment_service(request: Request) -> CommentService:
    return CommentService(get_github_client(request))


async def close_github_client(client: GitHubClient) -> AsyncIterator[None]:
    try:
        yield
    finally:
        await client.close()


def close_db_connection(connection: sqlite3.Connection) -> Iterator[None]:
    try:
        yield
    finally:
        connection.close()
