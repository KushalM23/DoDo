from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix="/tasks")


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
        "createdAt": row["created_at"],
    }


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
):
    query = auth.supabase.table("tasks").select("*").eq("user_id", auth.user_id)

    if categoryId:
        query = query.eq("category_id", categoryId)

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
        .insert({
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
        })
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

    payload: dict[str, Any] = {}
    for camel, snake in _FIELD_MAP.items():
        if camel in raw:
            val = raw[camel]
            if camel in ("title", "description") and isinstance(val, str):
                val = val.strip()
            payload[snake] = val

    if "completed" in payload:
        payload["completed_at"] = (
            datetime.now(timezone.utc).isoformat() if payload["completed"] else None
        )

    if not payload:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    resp = (
        auth.supabase.table("tasks")
        .update(payload)
        .eq("id", task_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found.")

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
