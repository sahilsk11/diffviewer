import sqlite3
from datetime import UTC, datetime

from diffviewer_api.models.state import FileReviewState, ReadState, StateUpdateResult


class ReadStateStore:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def get(self, owner: str, repo: str, pull_number: int) -> ReadState:
        rows = self._connection.execute(
            """
            select file_path, state from read_files
            where repo_owner = ? and repo_name = ? and pull_number = ?
            order by file_path
            """,
            (owner, repo, pull_number),
        ).fetchall()

        approved: list[str] = []
        flagged: list[str] = []
        skipped: list[str] = []
        for row in rows:
            state = row["state"]
            if state == FileReviewState.approved:
                approved.append(row["file_path"])
            elif state == FileReviewState.flagged:
                flagged.append(row["file_path"])
            elif state == FileReviewState.skipped:
                skipped.append(row["file_path"])
        return ReadState(approved=approved, flagged=flagged, skipped=skipped)

    def set(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        path: str,
        state: FileReviewState,
    ) -> StateUpdateResult:
        updated_at = datetime.now(UTC)
        if state == FileReviewState.unreviewed:
            self._connection.execute(
                """
                delete from read_files
                where repo_owner = ? and repo_name = ? and pull_number = ? and file_path = ?
                """,
                (owner, repo, pull_number, path),
            )
        else:
            self._connection.execute(
                """
                insert into read_files(
                    repo_owner, repo_name, pull_number, file_path, state, updated_at
                )
                values (?, ?, ?, ?, ?, ?)
                on conflict(repo_owner, repo_name, pull_number, file_path)
                do update set state = excluded.state, updated_at = excluded.updated_at
                """,
                (owner, repo, pull_number, path, state.value, updated_at.isoformat()),
            )
        self._connection.commit()
        return StateUpdateResult(path=path, state=state, updated_at=updated_at)
