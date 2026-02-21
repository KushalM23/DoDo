from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.progression import apply_experience_delta, habit_completion_xp

router = APIRouter(prefix="/habits")


FrequencyType = Literal["daily", "interval", "custom_days"]
HabitIcon = Literal[
    "book-open",
    "dumbbell",
    "droplets",
    "utensils",
    "bed",
    "target",
    "brain",
    "leaf",
    "music",
    "cup-soda",
]


def _today_utc_date() -> date_type:
    return datetime.now(timezone.utc).date()


def _parse_date(value: str) -> date_type:
    try:
        return date_type.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date value.") from exc


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


def _normalize_custom_days(days: list[int] | None) -> list[int]:
    if not days:
        return []
    cleaned = sorted({int(d) for d in days if 0 <= int(d) <= 6})
    return cleaned


def _weekday_sun_first(value: date_type) -> int:
    # Python weekday is Monday=0..Sunday=6; app uses Sunday=0..Saturday=6.
    return (value.weekday() + 1) % 7


def _habit_applies_on(row: dict, day: date_type) -> bool:
    anchor = row.get("anchor_date")
    if isinstance(anchor, str):
        anchor = _parse_date(anchor)
    if not isinstance(anchor, date_type):
        anchor = day
    if day < anchor:
        return False

    frequency_type = row.get("frequency_type") or "daily"

    if frequency_type == "daily":
        return True

    if frequency_type == "interval":
        interval_days = row.get("interval_days")
        if not interval_days:
            return False

        return ((day - anchor).days % interval_days) == 0

    custom_days = _normalize_custom_days(row.get("custom_days"))
    if not custom_days:
        return False
    return _weekday_sun_first(day) in custom_days


def _first_applicable_on_or_after(
    row: dict, start: date_type, max_days: int = 730
) -> date_type | None:
    for offset in range(max_days + 1):
        target = start + timedelta(days=offset)
        if _habit_applies_on(row, target):
            return target
    return None


def _habit_runtime_for_date(
    auth: AuthState, habit_ids: list[str], day: date_type
) -> tuple[dict[str, str], dict[str, int]]:
    if not habit_ids:
        return {}, {}

    sessions_resp = (
        auth.supabase.table("habit_sessions")
        .select("habit_id, started_at, ended_at, duration_seconds")
        .eq("user_id", auth.user_id)
        .eq("session_date", day.isoformat())
        .in_("habit_id", habit_ids)
        .execute()
    )

    now = datetime.now(timezone.utc)
    timer_started_map: dict[str, str] = {}
    tracked_seconds_map: dict[str, int] = {}

    for session in (sessions_resp.data or []):
        habit_id = str(session["habit_id"])
        tracked_seconds_map[habit_id] = tracked_seconds_map.get(habit_id, 0) + int(
            session.get("duration_seconds") or 0
        )

        if session.get("ended_at") is None and session.get("started_at"):
            started_at = str(session["started_at"])
            timer_started_map[habit_id] = started_at
            started_dt = _parse_iso_datetime(started_at, "started_at")
            tracked_seconds_map[habit_id] += max(
                0, int((now - started_dt).total_seconds())
            )

    return timer_started_map, tracked_seconds_map


def _to_habit_dto(
    row: dict,
    *,
    timer_started_at: str | None = None,
    tracked_seconds_today: int = 0,
) -> dict:
    custom_days = _normalize_custom_days(row.get("custom_days"))
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
        "timerStartedAt": timer_started_at,
        "trackedSecondsToday": max(0, int(tracked_seconds_today)),
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

    latest_completed = max(completed_days) if completed_days else None
    today = _today_utc_date()
    evaluation_end = max(today, latest_completed) if latest_completed else today

    best = 0
    run = 0
    current = 0
    last_applicable_completed: date_type | None = None

    if completed_days:
        earliest = min(completed_days)
        latest = evaluation_end
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
        "last_completed_on": last_applicable_completed.isoformat()
        if last_applicable_completed
        else None,
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


def _get_active_habit_session(
    auth: AuthState, habit_id: str, day: date_type
) -> dict | None:
    response = (
        auth.supabase.table("habit_sessions")
        .select("*")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("session_date", day.isoformat())
        .is_("ended_at", "null")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def _pause_active_habit_session(
    auth: AuthState, habit_id: str, day: date_type, now: datetime
) -> bool:
    active = _get_active_habit_session(auth, habit_id, day)
    if not active:
        return False

    started_at = _parse_iso_datetime(str(active["started_at"]), "started_at")
    elapsed = max(0, int((now - started_at).total_seconds()))
    total = int(active.get("duration_seconds") or 0) + elapsed

    (
        auth.supabase.table("habit_sessions")
        .update(
            {
                "ended_at": now.isoformat(),
                "duration_seconds": total,
            }
        )
        .eq("id", active["id"])
        .eq("user_id", auth.user_id)
        .execute()
    )
    return True


def _tracked_seconds_for_day(auth: AuthState, habit_id: str, day: date_type) -> int:
    response = (
        auth.supabase.table("habit_sessions")
        .select("duration_seconds, started_at, ended_at")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("session_date", day.isoformat())
        .execute()
    )
    total = 0
    now = datetime.now(timezone.utc)
    for row in (response.data or []):
        total += int(row.get("duration_seconds") or 0)
        if row.get("ended_at") is None and row.get("started_at"):
            started_at = _parse_iso_datetime(str(row["started_at"]), "started_at")
            total += max(0, int((now - started_at).total_seconds()))
    return max(0, total)


class CreateHabit(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    icon: HabitIcon = "target"
    frequencyType: FrequencyType = "daily"
    intervalDays: Optional[int] = Field(default=None, ge=2, le=365)
    customDays: list[int] = Field(default_factory=list)
    timeMinute: Optional[int] = Field(default=None, ge=0, le=1439)
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=720)


class UpdateHabit(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    icon: Optional[HabitIcon] = None
    frequencyType: Optional[FrequencyType] = None
    intervalDays: Optional[int] = Field(default=None, ge=2, le=365)
    customDays: Optional[list[int]] = None
    timeMinute: Optional[int] = Field(default=None, ge=0, le=1439)
    durationMinutes: Optional[int] = Field(default=None, ge=1, le=720)


class HabitCompletionBody(BaseModel):
    date: Optional[str] = None


class HabitSessionBody(BaseModel):
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
            raise HTTPException(
                status_code=400, detail="intervalDays is required for interval habits."
            )
        return interval_days, []

    if not cleaned_days:
        raise HTTPException(status_code=400, detail="Select at least one custom day.")
    return None, cleaned_days


@router.get("")
async def list_habits(auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("habits")
        .select("*")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = resp.data or []
    today = _today_utc_date()
    timer_started_map, tracked_seconds_map = _habit_runtime_for_date(
        auth, [str(r["id"]) for r in rows], today
    )

    return {
        "habits": [
            _to_habit_dto(
                row,
                timer_started_at=timer_started_map.get(str(row["id"])),
                tracked_seconds_today=tracked_seconds_map.get(str(row["id"]), 0),
            )
            for row in rows
        ]
    }


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
        .insert(
            {
                "user_id": auth.user_id,
                "title": body.title.strip(),
                "icon": body.icon,
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
            }
        )
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

    next_frequency_type: FrequencyType = updates.get(
        "frequencyType", current_row.get("frequency_type") or "daily"
    )
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
    if "icon" in updates:
        payload["icon"] = updates["icon"]
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
        raise HTTPException(
            status_code=400, detail="Both startDate and endDate are required together."
        )

    if startDate and endDate:
        start_date = _parse_date(startDate)
        end_date = _parse_date(endDate)
        if end_date < start_date:
            raise HTTPException(
                status_code=400, detail="endDate must be on or after startDate."
            )
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


@router.post("/{habit_id}/start")
async def start_habit(
    habit_id: str,
    body: HabitSessionBody,
    auth: AuthState = Depends(require_auth),
):
    row = _get_habit_or_404(auth, habit_id)
    target_date = _parse_date(body.date) if body.date else _today_utc_date()
    if not _habit_applies_on(row, target_date):
        raise HTTPException(status_code=400, detail="Habit does not apply on this date.")

    completion_resp = (
        auth.supabase.table("habit_completions")
        .select("id")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", target_date.isoformat())
        .limit(1)
        .execute()
    )
    if completion_resp.data:
        raise HTTPException(status_code=400, detail="Habit is already completed for this date.")

    active = _get_active_habit_session(auth, habit_id, target_date)
    if not active:
        now = datetime.now(timezone.utc).isoformat()
        (
            auth.supabase.table("habit_sessions")
            .insert(
                {
                    "user_id": auth.user_id,
                    "habit_id": habit_id,
                    "session_date": target_date.isoformat(),
                    "started_at": now,
                    "ended_at": None,
                    "duration_seconds": 0,
                }
            )
            .execute()
        )

    timer_started_map, tracked_seconds_map = _habit_runtime_for_date(auth, [habit_id], target_date)
    return {
        "habit": _to_habit_dto(
            row,
            timer_started_at=timer_started_map.get(habit_id),
            tracked_seconds_today=tracked_seconds_map.get(habit_id, 0),
        )
    }


@router.post("/{habit_id}/pause")
async def pause_habit(
    habit_id: str,
    body: HabitSessionBody,
    auth: AuthState = Depends(require_auth),
):
    row = _get_habit_or_404(auth, habit_id)
    target_date = _parse_date(body.date) if body.date else _today_utc_date()
    now = datetime.now(timezone.utc)
    _pause_active_habit_session(auth, habit_id, target_date, now)

    timer_started_map, tracked_seconds_map = _habit_runtime_for_date(auth, [habit_id], target_date)
    return {
        "habit": _to_habit_dto(
            row,
            timer_started_at=timer_started_map.get(habit_id),
            tracked_seconds_today=tracked_seconds_map.get(habit_id, 0),
        )
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

    now = datetime.now(timezone.utc)
    _pause_active_habit_session(auth, habit_id, completion_date, now)

    existing_completion_resp = (
        auth.supabase.table("habit_completions")
        .select("id, xp_awarded")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", completion_date.isoformat())
        .limit(1)
        .execute()
    )

    inserted_now = not bool(existing_completion_resp.data)
    if inserted_now:
        (
            auth.supabase.table("habit_completions")
            .insert(
                {
                    "user_id": auth.user_id,
                    "habit_id": habit_id,
                    "completed_on": completion_date.isoformat(),
                    "completed_at": now.isoformat(),
                    "xp_awarded": 0,
                }
            )
            .execute()
        )

    updated = _recalculate_streaks(auth, row)

    if inserted_now:
        tracked_seconds = _tracked_seconds_for_day(auth, habit_id, completion_date)
        actual_minutes = max(1, int(round(tracked_seconds / 60))) if tracked_seconds > 0 else None
        planned_minutes = int(row.get("duration_minutes") or 30)

        completed_on_time = True
        time_minute = row.get("time_minute")
        if isinstance(time_minute, int) and completion_date == _today_utc_date():
            completed_minute = now.hour * 60 + now.minute
            due_minute = min(1439, time_minute + planned_minutes)
            completed_on_time = completed_minute <= due_minute

        xp_awarded = habit_completion_xp(
            planned_minutes=planned_minutes,
            actual_minutes=actual_minutes,
            completed_on_time=completed_on_time,
            habit_streak=int(updated.get("current_streak") or 0),
        )

        (
            auth.supabase.table("habit_completions")
            .update({"xp_awarded": xp_awarded})
            .eq("user_id", auth.user_id)
            .eq("habit_id", habit_id)
            .eq("completed_on", completion_date.isoformat())
            .execute()
        )
        apply_experience_delta(auth.supabase, auth.user_id, xp_awarded)

    return {
        "habit": _to_habit_dto(updated, timer_started_at=None, tracked_seconds_today=0),
        "completion": {
            "habitId": habit_id,
            "date": completion_date.isoformat(),
            "completed": True,
        },
    }


@router.delete("/{habit_id}/complete")
async def uncomplete_habit(
    habit_id: str,
    auth: AuthState = Depends(require_auth),
    date: Optional[str] = Query(default=None),
):
    row = _get_habit_or_404(auth, habit_id)
    completion_date = _parse_date(date) if date else _today_utc_date()

    existing_completion_resp = (
        auth.supabase.table("habit_completions")
        .select("id, xp_awarded")
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", completion_date.isoformat())
        .limit(1)
        .execute()
    )
    xp_awarded = (
        int(existing_completion_resp.data[0].get("xp_awarded") or 0)
        if existing_completion_resp.data
        else 0
    )

    (
        auth.supabase.table("habit_completions")
        .delete()
        .eq("user_id", auth.user_id)
        .eq("habit_id", habit_id)
        .eq("completed_on", completion_date.isoformat())
        .execute()
    )

    if xp_awarded > 0:
        apply_experience_delta(auth.supabase, auth.user_id, -xp_awarded)

    updated = _recalculate_streaks(auth, row)
    timer_started_map, tracked_seconds_map = _habit_runtime_for_date(
        auth, [habit_id], completion_date
    )
    return {
        "habit": _to_habit_dto(
            updated,
            timer_started_at=timer_started_map.get(habit_id),
            tracked_seconds_today=tracked_seconds_map.get(habit_id, 0),
        ),
        "completion": {
            "habitId": habit_id,
            "date": completion_date.isoformat(),
            "completed": False,
        },
    }
