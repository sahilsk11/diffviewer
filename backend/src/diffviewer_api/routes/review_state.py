from typing import Annotated

from fastapi import APIRouter, Depends

from diffviewer_api.deps import get_read_state_store
from diffviewer_api.models.state import StateUpdate, StateUpdateResult
from diffviewer_api.services.read_state_store import ReadStateStore

router = APIRouter(
    prefix="/api/repos/{owner}/{repo}/pulls/{pull_number}/files",
    tags=["review-state"],
)


@router.put("/state", response_model=StateUpdateResult, response_model_by_alias=True)
async def update_file_state(
    owner: str,
    repo: str,
    pull_number: int,
    payload: StateUpdate,
    store: Annotated[ReadStateStore, Depends(get_read_state_store)],
) -> StateUpdateResult:
    return store.set(owner, repo, pull_number, payload.path, payload.state)
