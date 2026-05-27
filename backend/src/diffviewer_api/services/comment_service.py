from typing import Any

from diffviewer_api.models.comments import CommentCreate, PostedComment
from diffviewer_api.services.github_client import GitHubClient


class CommentService:
    def __init__(self, github: GitHubClient) -> None:
        self._github = github

    async def post(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        head_sha: str,
        comment: CommentCreate,
    ) -> PostedComment:
        payload: dict[str, Any] = {
            "body": comment.body,
            "commit_id": head_sha,
            "path": comment.path,
            "line": comment.line,
            "side": comment.side.value,
        }
        if comment.start_line is not None:
            payload["start_line"] = comment.start_line
        if comment.start_side is not None:
            payload["start_side"] = comment.start_side.value

        response = await self._github.post_pull_request_comment(owner, repo, pull_number, payload)
        return PostedComment(
            id=response["id"],
            html_url=response["html_url"],
            path=response["path"],
            line=response["line"],
            side=response["side"],
            body=response["body"],
        )
