from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix="/categories")


def _to_category_dto(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row.get("color") or "#E8651A",
        "icon": row.get("icon") or "inbox",
        "createdAt": row["created_at"],
        "updatedAt": row.get("updated_at") or row["created_at"],
    }


class CreateCategory(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=50)
    color: Literal[
        "#E8651A",
        "#30A46C",
        "#3B82F6",
        "#E5484D",
        "#F5A623",
        "#8B5CF6",
        "#14B8A6",
        "#EC4899",
    ] = "#E8651A"
    icon: Literal[
        "inbox",
        "briefcase",
        "check-square",
        "calendar",
        "flame",
        "heart",
        "user",
        "settings",
        "repeat",
        "zap",
    ] = "inbox"


class UpdateCategory(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: Literal[
        "#E8651A",
        "#30A46C",
        "#3B82F6",
        "#E5484D",
        "#F5A623",
        "#8B5CF6",
        "#14B8A6",
        "#EC4899",
    ] = "#E8651A"
    icon: Literal[
        "inbox",
        "briefcase",
        "check-square",
        "calendar",
        "flame",
        "heart",
        "user",
        "settings",
        "repeat",
        "zap",
    ] = "inbox"


@router.get("")
async def list_categories(auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("categories")
        .select("*")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return {"categories": [_to_category_dto(r) for r in resp.data]}


@router.post("", status_code=201)
async def create_category(body: CreateCategory, auth: AuthState = Depends(require_auth)):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    resp = (
        auth.supabase.table("categories")
        .insert(
            {
                **({"id": body.id} if body.id else {}),
                "user_id": auth.user_id,
                "name": body.name.strip(),
                "color": body.color,
                "icon": body.icon,
                "updated_at": now.isoformat(),
            }
        )
        .execute()
    )
    return {"category": _to_category_dto(resp.data[0])}


@router.patch("/{category_id}")
async def update_category(
    category_id: str, body: UpdateCategory, auth: AuthState = Depends(require_auth)
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    resp = (
        auth.supabase.table("categories")
        .update({"name": body.name.strip(), "color": body.color, "icon": body.icon, "updated_at": now.isoformat()})
        .eq("id", category_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Category not found.")

    return {"category": _to_category_dto(resp.data[0])}


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: str, auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("categories")
        .delete()
        .eq("id", category_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Category not found.")
