from __future__ import annotations

import math
from typing import Any


CATEGORY_COLOR_OPTIONS = (
    "#E5484D",
    "#EC4899",
    "#F97316",
    "#F59E0B",
    "#EAB308",
    "#84CC16",
    "#10B981",
    "#14B8A6",
    "#06B6D4",
    "#0EA5E9",
    "#3B82F6",
    "#64748B",
)

LEGACY_CATEGORY_COLOR_MAP = {
    "#A855F7": "#F97316",
    "#8B5CF6": "#0EA5E9",
    "#6366F1": "#3B82F6",
    "#E8651A": "#14B8A6",
    "#D85A12": "#14B8A6",
    "#30A46C": "#10B981",
    "#F5A623": "#F59E0B",
}

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


def normalize_category_color(color: str | None, *, fallback: bool = True) -> str:
    if not color:
        return DEFAULT_CATEGORY_COLOR
    if color in CATEGORY_COLOR_OPTIONS:
        return color
    if color in LEGACY_CATEGORY_COLOR_MAP:
        return LEGACY_CATEGORY_COLOR_MAP[color]
    return DEFAULT_CATEGORY_COLOR if fallback else color


def to_task_dto(row: dict[str, Any]) -> dict[str, Any]:
    actual_duration_seconds = row.get("actual_duration_seconds")
    if actual_duration_seconds is None:
        actual_duration_seconds = int(row.get("actual_duration_minutes") or 0) * 60

    actual_duration_seconds = max(0, int(actual_duration_seconds))
    actual_duration_minutes = row.get("actual_duration_minutes")
    if actual_duration_minutes is None:
        actual_duration_minutes = (
            math.ceil(actual_duration_seconds / 60) if actual_duration_seconds > 0 else 0
        )

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
        "actualDurationSeconds": actual_duration_seconds,
        "actualDurationMinutes": max(0, int(actual_duration_minutes or 0)),
        "completionXp": row.get("completion_xp") or 0,
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
        "deletedAt": row.get("deleted_at"),
    }


def to_category_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": normalize_category_color(row.get("color")),
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


def to_note_dto(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "heading": row.get("heading") or "",
        "contentRich": row.get("content_rich") or "",
        "contentPlain": row.get("content_plain") or "",
        "isPinned": bool(row.get("is_pinned", False)),
        "pinnedAt": row.get("pinned_at"),
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
        "deletedAt": row.get("deleted_at"),
    }
