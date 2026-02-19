from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix="/habits")


def _to_habit_dto(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "frequency": row["frequency"],
        "createdAt": row["created_at"],
    }


class CreateHabit(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    frequency: Literal["daily", "weekly"] = "daily"


class UpdateHabit(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    frequency: Optional[Literal["daily", "weekly"]] = None


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
    resp = (
        auth.supabase.table("habits")
        .insert({
            "user_id": auth.user_id,
            "title": body.title.strip(),
            "frequency": body.frequency,
        })
        .execute()
    )
    return {"habit": _to_habit_dto(resp.data[0])}


@router.patch("/{habit_id}")
async def update_habit(
    habit_id: str, body: UpdateHabit, auth: AuthState = Depends(require_auth)
):
    updates = body.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    payload: dict = {}
    if "title" in updates:
        payload["title"] = updates["title"].strip()
    if "frequency" in updates:
        payload["frequency"] = updates["frequency"]

    resp = (
        auth.supabase.table("habits")
        .update(payload)
        .eq("id", habit_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Habit not found.")

    return {"habit": _to_habit_dto(resp.data[0])}


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
