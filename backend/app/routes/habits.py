from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix="/habits")


FrequencyType = Literal["daily", "interval", "custom_days"]


def _today_utc_date() -> date_type:
    return datetime.now(timezone.utc).date()


def _parse_date(value: str) -> date_type:
    try:
        return date_type.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date value.") from exc


def _normalize_custom_days(days: list[int] | None) -> list[int]:
    if not days:
        return []
    cleaned = sorted({int(d) for d in days if 0 <= int(d) <= 6})
    return cleaned


def _weekday_sun_first(value: date_type) -> int:
    # Python weekday is Monday=0..Sunday=6; app uses Sunday=0..Saturday=6.
    return (value.weekday() + 1) % 7


def _habit_applies_on(row: dict, day: date_type) -> bool:
    frequency_type = row.get("frequency_type") or "daily"

    if frequency_type == "daily":
        return True

    if frequency_type == "interval":
        interval_days = row.get("interval_days")
        if not interval_days:
            return False

        anchor = row.get("anchor_date")
        if isinstance(anchor, str):
            anchor = _parse_date(anchor)
        if not isinstance(anchor, date_type):
            anchor = day

        if day < anchor:
            return False
        return ((day - anchor).days % interval_days) == 0

    custom_days = _normalize_custom_days(row.get("custom_days"))
    if not custom_days:
        return False
    return _weekday_sun_first(day) in custom_days


def _first_applicable_on_or_after(row: dict, start: date_type, max_days: int = 730) -> date_type | None:
    for offset in range(max_days + 1):
        target = start + timedelta(days=offset)
        if _habit_applies_on(row, target):
            return target
    return None


def _to_habit_dto(row: dict) -> dict:
    custom_days = _normalize_custom_days(row.get("custom_days"))
    frequency_type = row.get("frequency_type") or "daily"

    interval_days = row.get("interval_days")
    if frequency_type != "interval":
        interval_days = None

    return {
        "id": row["id"],
        "title": row["title"],
        "frequencyType": frequency_type,
        "intervalDays": interval_days,
        "customDays": custom_days,
        "timeMinute": row.get("time_minute"),
        "durationMinutes": row.get("duration_minutes"),
        "currentStreak": row.get("current_streak") or 0,
        "bestStreak": row.get("best_streak") or 0,
        "lastCompletedOn": row.get("last_completed_on"),
        "nextOccurrenceOn": row.get("next_occurrence_on"),
        "createdAt": row["created_at"],
    }


def _habit_history_rows(
    auth: AuthState,
    *,
    start_date: date_type,
    end_date: date_type,
    habit_id: str | None,
) -> list[dict]:
    query = (
        auth.supabase.table("habit_completions")
        .select("habit_id, completed_on")
        .eq("user_id", auth.user_id)
        .gte("completed_on", start_date.isoformat())
        .lte("completed_on", end_date.isoformat())
    )

    if habit_id:
        query = query.eq("habit_id", habit_id)

    response = query.execute()
    return response.data or []


def _recalculate_streaks(auth: AuthState, habit_row: dict) -> dict:
    habit_id = habit_row["id"]
    response = (
        auth.supabase.table("habit_completions")
        .select("completed_on")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .order("completed_on", desc=False)
        .execute()
    )

    completed_days = {
        _parse_date(str(item["completed_on"]))
        for item in (response.data or [])
        if item.get("completed_on")
    }

    today = _today_utc_date()

    best = 0
    run = 0
    current = 0
    last_applicable_completed: date_type | None = None

    if completed_days:
        earliest = min(completed_days)
        latest = today
        cursor = earliest
        while cursor <= latest:
            if _habit_applies_on(habit_row, cursor):
                if cursor in completed_days:
                    run += 1
                    best = max(best, run)
                    last_applicable_completed = cursor
                else:
                    run = 0
            cursor += timedelta(days=1)

        if last_applicable_completed is not None:
            cursor = last_applicable_completed
            while cursor >= earliest and _habit_applies_on(habit_row, cursor):
                if cursor in completed_days:
                    current += 1
                    cursor -= timedelta(days=1)
                    while cursor >= earliest and not _habit_applies_on(habit_row, cursor):
                        cursor -= timedelta(days=1)
                else:
                    break

    next_occurrence = _first_applicable_on_or_after(habit_row, today)

    updates = {
        "current_streak": current,
        "best_streak": best,
        "last_completed_on": last_applicable_completed.isoformat() if last_applicable_completed else None,
        "next_occurrence_on": next_occurrence.isoformat() if next_occurrence else None,
    }

    update_resp = (
        auth.supabase.table("habits")
        .update(updates)
        .eq("id", habit_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if update_resp.data:
        return update_resp.data[0]

    return {**habit_row, **updates}


class CreateHabit(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    frequencyType: FrequencyType = "daily"
    intervalDays: Optional[int] = Field(default=None, ge=2, le=365)
    customDays: list[int] = Field(default_factory=list)
    timeMinute: Optional[int] = Field(default=None, ge=0, le=1439)
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=720)


class UpdateHabit(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    frequencyType: Optional[FrequencyType] = None
    intervalDays: Optional[int] = Field(default=None, ge=2, le=365)
    customDays: Optional[list[int]] = None
    timeMinute: Optional[int] = Field(default=None, ge=0, le=1439)
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=720)


class HabitCompletionBody(BaseModel):
    date: Optional[str] = None


def _validated_frequency_payload(
    *,
    frequency_type: FrequencyType,
    interval_days: int | None,
    custom_days: list[int],
) -> tuple[int | None, list[int]]:
    cleaned_days = _normalize_custom_days(custom_days)

    if frequency_type == "daily":
        return None, []

    if frequency_type == "interval":
        if interval_days is None:
            raise HTTPException(status_code=400, detail="intervalDays is required for interval habits.")
        return interval_days, []

    if not cleaned_days:
        raise HTTPException(status_code=400, detail="Select at least one custom day.")
    return None, cleaned_days


def _get_habit_or_404(auth: AuthState, habit_id: str) -> dict:
    response = (
        auth.supabase.table("habits")
        .select("*")
        .eq("id", habit_id)
        .eq("user_id", auth.user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Habit not found.")
    return response.data[0]


@router.get("")
async def list_habits(auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("habits")
        .select("*")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return {"habits": [_to_habit_dto(r) for r in resp.data]}

@router.post("", status_code=201)
async def create_habit(body: CreateHabit, auth: AuthState = Depends(require_auth)):
    interval_days, custom_days = _validated_frequency_payload(
        frequency_type=body.frequencyType,
        interval_days=body.intervalDays,
        custom_days=body.customDays,
    )

    today = _today_utc_date()

    template = {
        "frequency_type": body.frequencyType,
        "interval_days": interval_days,
        "custom_days": custom_days,
        "anchor_date": today.isoformat(),
    }

    next_occurrence = _first_applicable_on_or_after(template, today)

    resp = (
        auth.supabase.table("habits")
        .insert({
            "user_id": auth.user_id,
            "title": body.title.strip(),
            "frequency_type": body.frequencyType,
            "interval_days": interval_days,
            "custom_days": custom_days,
            "time_minute": body.timeMinute,
            "duration_minutes": body.durationMinutes,
            "anchor_date": today.isoformat(),
            "current_streak": 0,
            "best_streak": 0,
            "last_completed_on": None,
            "next_occurrence_on": next_occurrence.isoformat() if next_occurrence else None,
        })
        .execute()
    )
    return {"habit": _to_habit_dto(resp.data[0])}


@router.patch("/{habit_id}")
async def update_habit(
    habit_id: str, body: UpdateHabit, auth: AuthState = Depends(require_auth)
):
    current_row = _get_habit_or_404(auth, habit_id)
    updates = body.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    next_frequency_type: FrequencyType = updates.get("frequencyType", current_row.get("frequency_type") or "daily")
    next_interval_days = updates.get("intervalDays", current_row.get("interval_days"))
    next_custom_days = updates.get("customDays", current_row.get("custom_days") or [])

    interval_days, custom_days = _validated_frequency_payload(
        frequency_type=next_frequency_type,
        interval_days=next_interval_days,
        custom_days=next_custom_days,
    )

    payload: dict = {
        "frequency_type": next_frequency_type,
        "interval_days": interval_days,
        "custom_days": custom_days,
    }

    if "title" in updates:
        payload["title"] = updates["title"].strip()
    if "timeMinute" in updates:
        payload["time_minute"] = updates["timeMinute"]
    if "durationMinutes" in updates:
        payload["duration_minutes"] = updates["durationMinutes"]

    next_occurrence = _first_applicable_on_or_after(
        {**current_row, **payload},
        _today_utc_date(),
    )
    payload["next_occurrence_on"] = next_occurrence.isoformat() if next_occurrence else None

    resp = (
        auth.supabase.table("habits")
        .update(payload)
        .eq("id", habit_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Habit not found.")

    updated = _recalculate_streaks(auth, resp.data[0])
    return {"habit": _to_habit_dto(updated)}


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(habit_id: str, auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("habits")
        .delete()
        .eq("id", habit_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Habit not found.")


@router.get("/history")
async def list_habit_history(
    auth: AuthState = Depends(require_auth),
    habitId: Optional[str] = Query(default=None),
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    days: int = Query(default=7, ge=1, le=180),
):
    if (startDate and not endDate) or (endDate and not startDate):
        raise HTTPException(status_code=400, detail="Both startDate and endDate are required together.")

    if startDate and endDate:
        start_date = _parse_date(startDate)
        end_date = _parse_date(endDate)
        if end_date < start_date:
            raise HTTPException(status_code=400, detail="endDate must be on or after startDate.")
    else:
        end_date = _today_utc_date()
        start_date = end_date - timedelta(days=days - 1)

    history_rows = _habit_history_rows(
        auth,
        start_date=start_date,
        end_date=end_date,
        habit_id=habitId,
    )

    return {
        "history": [
            {"habitId": row["habit_id"], "date": row["completed_on"]}
            for row in history_rows
        ]
    }


@router.post("/{habit_id}/complete")
async def complete_habit(
    habit_id: str,
    body: HabitCompletionBody,
    auth: AuthState = Depends(require_auth),
):
    row = _get_habit_or_404(auth, habit_id)
    completion_date = _parse_date(body.date) if body.date else _today_utc_date()

    if not _habit_applies_on(row, completion_date):
        raise HTTPException(status_code=400, detail="Habit does not apply on this date.")

    # Keep this idempotent without relying on a specific unique index shape.
    # Some databases may have older constraints that make upsert(on_conflict=...)
    # fail even though the operation intent is valid.
    (
        auth.supabase.table("habit_completions")
        .delete()
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", completion_date.isoformat())
        .execute()
    )

    (
        auth.supabase.table("habit_completions")
        .insert(
            {
                "user_id": auth.user_id,
                "habit_id": habit_id,
                "completed_on": completion_date.isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )

    updated = _recalculate_streaks(auth, row)
    return {
        "habit": _to_habit_dto(updated),
        "completion": {"habitId": habit_id, "date": completion_date.isoformat(), "completed": True},
    }


@router.delete("/{habit_id}/complete")
async def uncomplete_habit(
    habit_id: str,
    auth: AuthState = Depends(require_auth),
    date: Optional[str] = Query(default=None),
):
    row = _get_habit_or_404(auth, habit_id)
    completion_date = _parse_date(date) if date else _today_utc_date()

    (
        auth.supabase.table("habit_completions")
        .delete()
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", completion_date.isoformat())
        .execute()
    )

    updated = _recalculate_streaks(auth, row)
    return {
        "habit": _to_habit_dto(updated),
        "completion": {"habitId": habit_id, "date": completion_date.isoformat(), "completed": False},
    }
