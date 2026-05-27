from diffviewer_api.models.files import FileContents, FileSide, RepositoryTree, TreeEntry
from diffviewer_api.services.github_client import GitHubClient, decode_blob_contents


class FileService:
    def __init__(self, github: GitHubClient) -> None:
        self._github = github
        self._tree_cache: dict[str, RepositoryTree] = {}

    async def tree(self, owner: str, repo: str, head_sha: str) -> RepositoryTree:
        cache_key = f"{owner}/{repo}@{head_sha}"
        cached = self._tree_cache.get(cache_key)
        if cached is not None:
            return cached

        payload = await self._github.get_tree(owner, repo, head_sha)
        entries = [
            TreeEntry(
                path=item["path"],
                type=item["type"],
                sha=item["sha"],
                size=item.get("size"),
            )
            for item in payload.get("tree", [])
        ]
        tree = RepositoryTree(
            head_sha=head_sha,
            truncated=bool(payload.get("truncated", False)),
            entries=entries,
        )
        self._tree_cache[cache_key] = tree
        return tree

    async def contents(
        self,
        owner: str,
        repo: str,
        head_sha: str,
        path: str,
        side: FileSide,
    ) -> FileContents:
        tree = await self.tree(owner, repo, head_sha)
        entry = next(
            (item for item in tree.entries if item.path == path and item.type == "blob"),
            None,
        )
        if entry is None:
            from diffviewer_api.services.github_client import GitHubError

            raise GitHubError(
                "File was not found in the pull request tree.",
                status_code=404,
                code="github_not_found",
            )
        payload = await self._github.get_blob(owner, repo, entry.sha)
        return FileContents(
            path=path,
            side=side,
            sha=entry.sha,
            contents=decode_blob_contents(payload),
        )
