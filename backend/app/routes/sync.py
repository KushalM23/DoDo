from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth import AuthState, require_auth
from app.contracts import (
    to_category_dto,
    to_habit_completion_dto,
    to_habit_dto,
    to_note_dto,
    to_task_dto,
)

router = APIRouter(prefix="/sync")


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    raw = value.strip()
    if raw.endswith("Z"):
        raw = f"{raw[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} datetime.") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

class SyncPullResponse(BaseModel):
    tasks: list[dict[str, Any]]
    categories: list[dict[str, Any]]
    habits: list[dict[str, Any]]
    notes: list[dict[str, Any]]
    habitCompletions: list[dict[str, Any]]
    serverTime: str


@router.get("/pull")
async def sync_pull(
    auth: AuthState = Depends(require_auth),
    since: Optional[str] = Query(default=None),
) -> SyncPullResponse:
    """
    Incremental pull endpoint for sync.
    Returns all changed entities since the given timestamp.
    """
    now = datetime.now(timezone.utc)

    if since:
        cutoff = _parse_iso_datetime(since, "since")
    else:
        cutoff = datetime(2020, 1, 1, tzinfo=timezone.utc)

    tasks_resp = (
        auth.supabase.table("tasks")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    tasks = [to_task_dto(r) for r in (tasks_resp.data or [])]

    categories_resp = (
        auth.supabase.table("categories")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    categories = [to_category_dto(r) for r in (categories_resp.data or [])]

    habits_resp = (
        auth.supabase.table("habits")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    habits = [to_habit_dto(r) for r in (habits_resp.data or [])]

    notes_resp = (
        auth.supabase.table("notes")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    notes = [to_note_dto(r) for r in (notes_resp.data or [])]

    completions_resp = (
        auth.supabase.table("habit_completions")
        .select("habit_id, completed_on, completed, updated_at, completed_at")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    habit_completions = [to_habit_completion_dto(r) for r in (completions_resp.data or [])]

    return SyncPullResponse(
        tasks=tasks,
        categories=categories,
        habits=habits,
        notes=notes,
        habitCompletions=habit_completions,
        serverTime=now.isoformat(),
    )
