import sqlite3
from pathlib import Path

SCHEMA = """
create table if not exists read_files(
  repo_owner text not null,
  repo_name text not null,
  pull_number integer not null,
  file_path text not null,
  state text not null,
  updated_at text not null,
  primary key(repo_owner, repo_name, pull_number, file_path)
)
"""


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute(SCHEMA)
    connection.commit()
    return connection
