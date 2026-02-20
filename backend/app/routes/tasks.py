from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.progression import apply_experience_delta, task_completion_xp

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


def _parse_date(value: str) -> date_type:
    try:
        return date_type.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date value.") from exc


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
    }


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


def _task_completion_streak(auth: AuthState, candidate_day: date_type | None = None) -> int:
    response = (
        auth.supabase.table("tasks")
        .select("completed_at")
        .eq("user_id", auth.user_id)
        .eq("completed", True)
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
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default="", max_length=1000)
    categoryId: Optional[str] = None
    scheduledAt: str
    deadline: str
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=1440)
    priority: int = Field(ge=1, le=3)


@router.get("")
async def list_tasks(
    auth: AuthState = Depends(require_auth),
    categoryId: Optional[str] = Query(default=None),
    startAt: Optional[str] = Query(default=None),
    endAt: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
):
    if date and (startAt or endAt):
        raise HTTPException(
            status_code=400,
            detail="Use either date or startAt/endAt filters, not both.",
        )

    query = auth.supabase.table("tasks").select("*").eq("user_id", auth.user_id)

    if categoryId:
        query = query.eq("category_id", categoryId)

    if date:
        day_start = datetime.combine(_parse_date(date), datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
        day_end = day_start + timedelta(days=1)
        query = query.gte("scheduled_at", day_start.isoformat()).lt(
            "scheduled_at", day_end.isoformat()
        )
    elif startAt or endAt:
        if not startAt or not endAt:
            raise HTTPException(
                status_code=400,
                detail="Both startAt and endAt are required for range filtering.",
            )

        start_dt = _parse_iso_datetime(startAt, "startAt")
        end_dt = _parse_iso_datetime(endAt, "endAt")
        if end_dt <= start_dt:
            raise HTTPException(status_code=400, detail="endAt must be after startAt.")

        query = query.gte("scheduled_at", start_dt.isoformat()).lt(
            "scheduled_at", end_dt.isoformat()
        )

    query = (
        query.order("completed", desc=False)
        .order("priority", desc=True)
        .order("deadline", desc=False)
    )

    resp = query.execute()
    return {"tasks": [_to_task_dto(r) for r in resp.data]}


@router.post("", status_code=201)
async def create_task(body: CreateTask, auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("tasks")
        .insert(
            {
                "user_id": auth.user_id,
                "title": body.title.strip(),
                "description": body.description.strip(),
                "category_id": body.categoryId,
                "scheduled_at": body.scheduledAt,
                "deadline": body.deadline,
                "duration_minutes": body.durationMinutes,
                "priority": body.priority,
                "completed": False,
                "completed_at": None,
                "timer_started_at": None,
                "actual_duration_minutes": 0,
                "completion_xp": 0,
            }
        )
        .execute()
    )
    return {"task": _to_task_dto(resp.data[0])}


_FIELD_MAP = {
    "title": "title",
    "description": "description",
    "categoryId": "category_id",
    "scheduledAt": "scheduled_at",
    "deadline": "deadline",
    "durationMinutes": "duration_minutes",
    "priority": "priority",
    "completed": "completed",
    "timerStartedAt": "timer_started_at",
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
                val = val.strip()
            payload[snake] = val

    if not payload:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    now = datetime.now(timezone.utc)
    previous_completed = bool(current_row.get("completed"))
    next_completed = bool(payload["completed"]) if "completed" in payload else previous_completed
    xp_delta = 0

    actual_minutes = int(current_row.get("actual_duration_minutes") or 0)
    has_active_timer = bool(current_row.get("timer_started_at"))
    should_close_timer = (
        has_active_timer
        and (
            ("timer_started_at" in payload and payload["timer_started_at"] is None)
            or (next_completed and not previous_completed)
        )
    )

    if should_close_timer and current_row.get("timer_started_at"):
        actual_minutes += _elapsed_minutes(str(current_row["timer_started_at"]), now)
        payload["actual_duration_minutes"] = max(0, actual_minutes)

    if "timer_started_at" in payload and payload["timer_started_at"]:
        _parse_iso_datetime(str(payload["timer_started_at"]), "timerStartedAt")

    if next_completed and not previous_completed:
        payload["completed_at"] = now.isoformat()
        payload["timer_started_at"] = None

        merged_row = {**current_row, **payload}
        planned_minutes = _planned_minutes(merged_row)
        actual_for_score = max(1, int(merged_row.get("actual_duration_minutes") or planned_minutes))
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
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found.")

    if xp_delta != 0:
        apply_experience_delta(auth.supabase, auth.user_id, xp_delta)

    return {"task": _to_task_dto(resp.data[0])}


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
