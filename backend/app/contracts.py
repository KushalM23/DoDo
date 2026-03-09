from __future__ import annotations

from typing import Any


CATEGORY_COLOR_OPTIONS = (
    "#E5484D",
    "#EC4899",
    "#A855F7",
    "#8B5CF6",
    "#6366F1",
    "#3B82F6",
    "#0EA5E9",
    "#06B6D4",
    "#14B8A6",
    "#10B981",
    "#84CC16",
    "#EAB308",
)

CATEGORY_ICON_OPTIONS = (
    "briefcase",
    "heart",
    "user",
    "book-open",
    "dumbbell",
    "droplets",
    "utensils",
    "bed",
    "brain",
    "music",
    "sun",
    "moon",
    "coffee",
    "shopping-cart",
)

HABIT_ICON_OPTIONS = CATEGORY_ICON_OPTIONS

DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_OPTIONS[0]
DEFAULT_CATEGORY_ICON = "user"
DEFAULT_HABIT_ICON = "book-open"


def to_task_dto(row: dict[str, Any]) -> dict[str, Any]:
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
        "deletedAt": row.get("deleted_at"),
    }


def to_category_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row.get("color") or DEFAULT_CATEGORY_COLOR,
        "icon": row.get("icon") or DEFAULT_CATEGORY_ICON,
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
        "deletedAt": row.get("deleted_at"),
    }


def to_habit_dto(
    row: dict[str, Any],
    *,
    timer_started_at: str | None = None,
    tracked_seconds_today: int = 0,
) -> dict[str, Any]:
    custom_days = row.get("custom_days") or []
    frequency_type = row.get("frequency_type") or "daily"

    interval_days = row.get("interval_days")
    if frequency_type != "interval":
        interval_days = None

    return {
        "id": row["id"],
        "title": row["title"],
        "icon": row.get("icon") or DEFAULT_HABIT_ICON,
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
        "updatedAt": row.get("updated_at") or row["created_at"],
        "deletedAt": row.get("deleted_at"),
    }


def to_habit_completion_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "habitId": str(row["habit_id"]),
        "date": str(row["completed_on"]),
        "completed": bool(row.get("completed", True)),
        "updatedAt": row.get("updated_at") or row.get("completed_at"),
    }
