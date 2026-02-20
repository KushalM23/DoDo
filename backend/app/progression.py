from __future__ import annotations

import math
from typing import Optional

from supabase import Client


def xp_needed_for_level(level: int) -> int:
    normalized = max(1, level)
    return max(1, int(round(200 * (1.35 ** (normalized - 1)))))


def progress_from_experience(total_xp: int) -> dict:
    xp = max(0, int(total_xp))
    level = 1
    remaining = xp
    needed = xp_needed_for_level(level)
    while remaining >= needed:
        remaining -= needed
        level += 1
        needed = xp_needed_for_level(level)

    return {
        "experiencePoints": xp,
        "level": level,
        "xpIntoLevel": remaining,
        "xpForNextLevel": needed,
        "xpToNextLevel": max(0, needed - remaining),
    }


def streak_milestone_bonus(streak: int) -> int:
    milestones = {
        3: 10,
        7: 25,
        14: 55,
        30: 120,
    }
    return milestones.get(max(0, streak), 0)


def _duration_efficiency_bonus(
    planned_minutes: Optional[int], actual_minutes: Optional[int], *, habit: bool
) -> int:
    if not planned_minutes or planned_minutes <= 0:
        return 0
    if actual_minutes is None or actual_minutes <= 0:
        return 0

    ratio = actual_minutes / planned_minutes
    if ratio <= 0.85:
        return 18 if habit else 14
    if ratio <= 1.0:
        return 14 if habit else 10
    if ratio <= 1.15:
        return 10 if habit else 7
    if ratio <= 1.35:
        return 4 if habit else 2
    if ratio <= 1.65:
        return 0
    return -8 if habit else -6


def task_completion_xp(
    *,
    priority: int,
    planned_minutes: Optional[int],
    actual_minutes: Optional[int],
    completed_on_time: bool,
    completion_streak: int,
) -> int:
    priority_bonus = {1: 6, 2: 14, 3: 24}.get(priority, 10)
    duration_bonus = min(40, int(round((planned_minutes or 0) * 0.25)))
    efficiency_bonus = _duration_efficiency_bonus(planned_minutes, actual_minutes, habit=False)
    on_time_bonus = 16 if completed_on_time else 0
    streak_bonus = streak_milestone_bonus(completion_streak)

    total = 35 + priority_bonus + duration_bonus + efficiency_bonus + on_time_bonus + streak_bonus
    return max(10, total)


def habit_completion_xp(
    *,
    planned_minutes: Optional[int],
    actual_minutes: Optional[int],
    completed_on_time: bool,
    habit_streak: int,
) -> int:
    duration_bonus = min(60, int(round((planned_minutes or 0) * 0.35)))
    efficiency_bonus = _duration_efficiency_bonus(planned_minutes, actual_minutes, habit=True)
    on_time_bonus = 24 if completed_on_time else 8
    streak_bonus = streak_milestone_bonus(habit_streak)
    consistency_bonus = int(min(25, math.floor(max(0, habit_streak) * 1.5)))

    total = 55 + duration_bonus + efficiency_bonus + on_time_bonus + streak_bonus + consistency_bonus
    return max(18, total)


def apply_experience_delta(supabase: Client, user_id: str, delta: int) -> dict:
    response = (
        supabase.table("profiles")
        .select("id, experience_points, current_level")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if response.data:
        current_xp = int(response.data[0].get("experience_points") or 0)
    else:
        return progress_from_experience(0)

    next_xp = max(0, current_xp + int(delta))
    progress = progress_from_experience(next_xp)

    (
        supabase.table("profiles")
        .update(
            {
                "experience_points": progress["experiencePoints"],
                "current_level": progress["level"],
            }
        )
        .eq("id", user_id)
        .execute()
    )

    return progress
