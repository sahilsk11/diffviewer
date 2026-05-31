from __future__ import annotations

import asyncio
import re
from collections.abc import Sequence
from typing import Any

from diffviewer_api.models.github import PullRequestRecommendation, PullRequestRef
from diffviewer_api.services.github_client import GitHubClient, GitHubError

REPO_REF_RE = re.compile(r"^[^/\s]+/[^/\s]+$")
PR_HTML_URL_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/pull/([0-9]+)$")
DEFAULT_LIMIT = 3
RECOMMENDED_PULL_REQUEST_REPOSITORIES = (
    "sahilsk11/sas",
    "sahilsk11/code-reviewer",
    "sahilsk11/diffviewer",
)


class PullRequestRecommendationService:
    def __init__(
        self,
        github: GitHubClient,
        repositories: Sequence[str] = RECOMMENDED_PULL_REQUEST_REPOSITORIES,
    ) -> None:
        self._github = github
        self._repositories = [repo for repo in repositories if REPO_REF_RE.match(repo)]

    async def list(self, *, limit: int = DEFAULT_LIMIT) -> list[PullRequestRecommendation]:
        if limit < 1:
            return []

        return await self._list_for_repositories(limit)

    async def _list_for_repositories(self, limit: int) -> list[PullRequestRecommendation]:
        recommendations: list[PullRequestRecommendation] = []
        results = await asyncio.gather(
            *[
                self._search(f"repo:{repo} is:pr is:open archived:false", limit=limit)
                for repo in self._repositories
            ],
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, GitHubError):
                if result.status_code not in {403, 404}:
                    raise result
                continue
            if isinstance(result, BaseException):
                raise result
            recommendations.extend(result)

        return self._latest_unique(recommendations, limit=limit)

    async def _search(self, query: str, *, limit: int) -> list[PullRequestRecommendation]:
        items = await self._github.search_pull_requests(query, limit=limit)
        recommendations: list[PullRequestRecommendation] = []
        for item in items:
            recommendation = self._map_search_item(item)
            if recommendation is not None:
                recommendations.append(recommendation)
        return recommendations

    def _map_search_item(self, item: dict[str, Any]) -> PullRequestRecommendation | None:
        if "pull_request" not in item:
            return None

        html_url = item.get("html_url")
        title = item.get("title")
        number = item.get("number")
        created_at = item.get("created_at")
        updated_at = item.get("updated_at")
        user = item.get("user")
        author = user.get("login") if isinstance(user, dict) else None
        if (
            not isinstance(html_url, str)
            or not isinstance(title, str)
            or not isinstance(number, int)
            or not isinstance(created_at, str)
            or not isinstance(updated_at, str)
            or not isinstance(author, str)
        ):
            return None

        match = PR_HTML_URL_RE.match(html_url)
        if match is None:
            return None

        owner, repo, pull_number = match.groups()
        if int(pull_number) != number:
            return None

        return PullRequestRecommendation(
            ref=PullRequestRef(owner=owner, repo=repo, pull_number=number),
            title=title,
            html_url=html_url,
            author=author,
            created_at=created_at,
            updated_at=updated_at,
        )

    def _latest_unique(
        self,
        recommendations: list[PullRequestRecommendation],
        *,
        limit: int,
    ) -> list[PullRequestRecommendation]:
        by_url: dict[str, PullRequestRecommendation] = {}
        for recommendation in recommendations:
            by_url.setdefault(recommendation.html_url, recommendation)
        return sorted(
            by_url.values(),
            key=lambda recommendation: recommendation.updated_at,
            reverse=True,
        )[:limit]
