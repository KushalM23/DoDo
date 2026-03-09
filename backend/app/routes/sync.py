from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth import AuthState, require_auth

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


def _to_task_dto(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row.get("description") or "",
        "categoryId": row.get("category_id"),
        "scheduledAt": row["scheduled_at"],
        "deadline": row["deadline"],
        "durationMinutes": row.get("duration_minutes"),
        "priority": row["priority"],
        "completed": row["completed"],
        "completedAt": row.get("completed_at"),
        "timerStartedAt": row.get("timer_started_at"),
        "actualDurationMinutes": row.get("actual_duration_minutes") or 0,
        "completionXp": row.get("completion_xp") or 0,
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
    }


def _to_category_dto(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row.get("color") or "#E8651A",
        "icon": row.get("icon") or "inbox",
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
    }


def _to_habit_dto(row: dict) -> dict:
    custom_days = row.get("custom_days") or []
    frequency_type = row.get("frequency_type") or "daily"
    interval_days = row.get("interval_days")
    if frequency_type != "interval":
        interval_days = None

    return {
        "id": row["id"],
        "title": row["title"],
        "icon": row.get("icon") or "target",
        "frequencyType": frequency_type,
        "intervalDays": interval_days,
        "customDays": custom_days,
        "timeMinute": row.get("time_minute"),
        "durationMinutes": row.get("duration_minutes"),
        "anchorDate": row.get("anchor_date"),
        "currentStreak": row.get("current_streak") or 0,
        "bestStreak": row.get("best_streak") or 0,
        "lastCompletedOn": row.get("last_completed_on"),
        "nextOccurrenceOn": row.get("next_occurrence_on"),
        "timerStartedAt": None,
        "trackedSecondsToday": 0,
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
    }


class SyncPullResponse(BaseModel):
    tasks: list[dict[str, Any]]
    categories: list[dict[str, Any]]
    habits: list[dict[str, Any]]
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
    tasks = [_to_task_dto(r) for r in (tasks_resp.data or [])]

    categories_resp = (
        auth.supabase.table("categories")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    categories = [_to_category_dto(r) for r in (categories_resp.data or [])]

    habits_resp = (
        auth.supabase.table("habits")
        .select("*")
        .eq("user_id", auth.user_id)
        .gte("updated_at", cutoff.isoformat())
        .execute()
    )
    habits = [_to_habit_dto(r) for r in (habits_resp.data or [])]

    completions_resp = (
        auth.supabase.table("habit_completions")
        .select("habit_id, completed_on")
        .eq("user_id", auth.user_id)
        .gte("completed_at", cutoff.isoformat())
        .execute()
    )
    habit_completions = [
        {"habitId": str(r["habit_id"]), "date": str(r["completed_on"])}
        for r in (completions_resp.data or [])
    ]

    return SyncPullResponse(
        tasks=tasks,
        categories=categories,
        habits=habits,
        habitCompletions=habit_completions,
        serverTime=now.isoformat(),
    )
