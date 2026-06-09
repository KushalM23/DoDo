from __future__ import annotations

import math
from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.contracts import to_task_dto
from app.progression import apply_experience_delta, task_completion_xp
from app.encryption import encrypt

router = APIRouter(prefix="/tasks")


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    raw = value.strip()
    if raw.endswith("Z"):
        raw = f"{raw[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} datetime.") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

def _planned_minutes(task_row: dict) -> int:
    explicit = task_row.get("duration_minutes")
    if explicit and int(explicit) > 0:
        return int(explicit)

    scheduled_at = _parse_iso_datetime(str(task_row["scheduled_at"]), "scheduled_at")
    deadline = _parse_iso_datetime(str(task_row["deadline"]), "deadline")
    diff = max(1, int((deadline - scheduled_at).total_seconds() // 60))
    return diff


def _elapsed_minutes(started_at: str, now_utc: datetime) -> int:
    start_dt = _parse_iso_datetime(str(started_at), "timerStartedAt")
    return max(0, int((now_utc - start_dt).total_seconds() // 60))


def _elapsed_seconds(started_at: str, now_utc: datetime) -> int:
    start_dt = _parse_iso_datetime(str(started_at), "timerStartedAt")
    return max(0, int((now_utc - start_dt).total_seconds()))


def _seconds_to_minutes(seconds: int) -> int:
    safe_seconds = max(0, int(seconds))
    if safe_seconds == 0:
        return 0
    return math.ceil(safe_seconds / 60)


def _task_duration_seconds(row: dict[str, Any]) -> int:
    if row.get("actual_duration_seconds") is not None:
        return max(0, int(row.get("actual_duration_seconds") or 0))
    return max(0, int(row.get("actual_duration_minutes") or 0) * 60)


def _fallback_task_duration_seconds(row: dict[str, Any]) -> int:
    tracked_seconds = _task_duration_seconds(row)
    if tracked_seconds > 0:
        return tracked_seconds
    return max(60, _planned_minutes(row) * 60)


def _task_completion_streak(auth: AuthState, candidate_day: date_type | None = None) -> int:
    response = (
        auth.supabase.table("tasks")
        .select("completed_at")
        .eq("user_id", auth.user_id)
        .eq("completed", True)
        .is_("deleted_at", "null")
        .order("completed_at", desc=False)
        .execute()
    )

    completed_days: set[date_type] = set()
    for row in (response.data or []):
        if not row.get("completed_at"):
            continue
        completed_at = _parse_iso_datetime(str(row["completed_at"]), "completed_at")
        completed_days.add(completed_at.date())

    if candidate_day:
        completed_days.add(candidate_day)

    if not completed_days:
        return 0

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    if today in completed_days:
        cursor = today
    elif yesterday in completed_days:
        cursor = yesterday
    else:
        return 0

    streak = 0
    while cursor in completed_days:
        streak += 1
        cursor -= timedelta(days=1)

    return streak


class CreateTask(BaseModel):
    id: Optional[str] = None
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default="", max_length=1000)
    categoryId: Optional[str] = None
    scheduledAt: str
    deadline: str
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=1440)
    priority: int = Field(ge=1, le=3)


@router.post("", status_code=201)
async def create_task(body: CreateTask, auth: AuthState = Depends(require_auth)):
    now = datetime.now(timezone.utc)
    resp = (
        auth.supabase.table("tasks")
        .insert(
            {
                **({"id": body.id} if body.id else {}),
                "user_id": auth.user_id,
                "title": encrypt(body.title.strip()),
                "description": encrypt(body.description.strip()),
                "category_id": body.categoryId,
                "scheduled_at": body.scheduledAt,
                "deadline": body.deadline,
                "duration_minutes": body.durationMinutes,
                "priority": body.priority,
                "completed": False,
                "completed_at": None,
                "timer_started_at": None,
                "actual_duration_seconds": 0,
                "actual_duration_minutes": 0,
                "completion_xp": 0,
                "updated_at": now.isoformat(),
                "deleted_at": None,
            }
        )
        .execute()
    )
    return {"task": to_task_dto(resp.data[0])}


_FIELD_MAP = {
    "title": "title",
    "description": "description",
    "categoryId": "category_id",
    "scheduledAt": "scheduled_at",
    "deadline": "deadline",
    "durationMinutes": "duration_minutes",
    "priority": "priority",
    "completed": "completed",
}


@router.patch("/{task_id}")
async def update_task(task_id: str, request: Request, auth: AuthState = Depends(require_auth)):
    raw: dict[str, Any] = await request.json()

    if not raw:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    current_resp = (
        auth.supabase.table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if not current_resp.data:
        raise HTTPException(status_code=404, detail="Task not found.")
    current_row = current_resp.data[0]

    payload: dict[str, Any] = {}
    for camel, snake in _FIELD_MAP.items():
        if camel in raw:
            val = raw[camel]
            if camel in ("title", "description") and isinstance(val, str):
                val = encrypt(val.strip())
            payload[snake] = val

    if "actualDurationSeconds" in raw and raw["actualDurationSeconds"] is not None:
        try:
            requested_seconds = max(0, int(raw["actualDurationSeconds"]))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid actualDurationSeconds value.") from exc

        current_seconds = _task_duration_seconds(current_row)
        if requested_seconds < current_seconds:
            raise HTTPException(status_code=400, detail="Task timer cannot be reset.")

        payload["actual_duration_seconds"] = requested_seconds
        payload["actual_duration_minutes"] = _seconds_to_minutes(requested_seconds)
    elif "actualDurationMinutes" in raw and raw["actualDurationMinutes"] is not None:
        try:
            requested_minutes = max(0, int(raw["actualDurationMinutes"]))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid actualDurationMinutes value.") from exc

        current_seconds = _task_duration_seconds(current_row)
        requested_seconds = requested_minutes * 60
        if requested_seconds < current_seconds:
            raise HTTPException(status_code=400, detail="Task timer cannot be reset.")

        payload["actual_duration_seconds"] = requested_seconds
        payload["actual_duration_minutes"] = requested_minutes

    if not payload:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    now = datetime.now(timezone.utc)
    payload["updated_at"] = now.isoformat()

    previous_completed = bool(current_row.get("completed"))
    next_completed = bool(payload["completed"]) if "completed" in payload else previous_completed
    xp_delta = 0

    actual_seconds = int(payload.get("actual_duration_seconds", _task_duration_seconds(current_row)))
    active_started_at = current_row.get("timer_started_at")
    has_client_duration = "actual_duration_seconds" in payload

    if "timerStartedAt" in raw:
        requested_timer_started_at = raw["timerStartedAt"]
        if requested_timer_started_at:
            parsed_started_at = _parse_iso_datetime(
                str(requested_timer_started_at),
                "timerStartedAt",
            )
            if next_completed:
                raise HTTPException(
                    status_code=400,
                    detail="Completed tasks cannot have an active timer.",
                )
            if not active_started_at:
                active_started_at = parsed_started_at.isoformat()
                payload["timer_started_at"] = active_started_at
        else:
            payload["timer_started_at"] = None
            if active_started_at and not has_client_duration:
                actual_seconds += _elapsed_seconds(str(active_started_at), now)
            active_started_at = None

    payload["actual_duration_seconds"] = actual_seconds
    payload["actual_duration_minutes"] = _seconds_to_minutes(actual_seconds)

    if next_completed and not previous_completed:
        if active_started_at:
            if not has_client_duration:
                actual_seconds += _elapsed_seconds(str(active_started_at), now)
            active_started_at = None

        if actual_seconds <= 0:
            actual_seconds = _fallback_task_duration_seconds({**current_row, **payload})

        payload["completed_at"] = now.isoformat()
        payload["timer_started_at"] = None
        payload["actual_duration_seconds"] = actual_seconds
        payload["actual_duration_minutes"] = _seconds_to_minutes(actual_seconds)

        merged_row = {**current_row, **payload}
        planned_minutes = _planned_minutes(merged_row)
        actual_for_score = max(
            1,
            _seconds_to_minutes(_task_duration_seconds(merged_row)) or planned_minutes,
        )
        completed_on_time = now <= _parse_iso_datetime(str(merged_row["deadline"]), "deadline")
        streak = _task_completion_streak(auth, candidate_day=now.date())
        completion_xp = task_completion_xp(
            priority=int(merged_row.get("priority") or 2),
            planned_minutes=planned_minutes,
            actual_minutes=actual_for_score,
            completed_on_time=completed_on_time,
            completion_streak=streak,
        )
        payload["completion_xp"] = completion_xp
        xp_delta = completion_xp

    elif previous_completed and not next_completed:
        payload["completed_at"] = None
        deduction = int(current_row.get("completion_xp") or 0)
        payload["completion_xp"] = 0
        xp_delta = -deduction if deduction > 0 else 0

    resp = (
        auth.supabase.table("tasks")
        .update(payload)
        .eq("id", task_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found.")

    if xp_delta != 0:
        apply_experience_delta(auth.supabase, auth.user_id, xp_delta)

    return {"task": to_task_dto(resp.data[0])}


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found.")
