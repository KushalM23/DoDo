from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.auth import AuthState, require_auth
from app.contracts import (
    CATEGORY_COLOR_OPTIONS,
    CATEGORY_ICON_OPTIONS,
    DEFAULT_CATEGORY_COLOR,
    DEFAULT_CATEGORY_ICON,
    normalize_category_color,
    to_category_dto,
)

router = APIRouter(prefix="/categories")


def _validate_choice(value: str, allowed: tuple[str, ...], field_name: str) -> str:
    if value not in allowed:
        raise ValueError(f"Invalid {field_name}.")
    return value


class CreateCategory(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=50)
    color: str = DEFAULT_CATEGORY_COLOR
    icon: str = DEFAULT_CATEGORY_ICON

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        return _validate_choice(
            normalize_category_color(value, fallback=False),
            CATEGORY_COLOR_OPTIONS,
            "category color",
        )

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, value: str) -> str:
        return _validate_choice(value, CATEGORY_ICON_OPTIONS, "category icon")


class UpdateCategory(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = DEFAULT_CATEGORY_COLOR
    icon: str = DEFAULT_CATEGORY_ICON

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        return _validate_choice(
            normalize_category_color(value, fallback=False),
            CATEGORY_COLOR_OPTIONS,
            "category color",
        )

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, value: str) -> str:
        return _validate_choice(value, CATEGORY_ICON_OPTIONS, "category icon")


@router.post("", status_code=201)
async def create_category(body: CreateCategory, auth: AuthState = Depends(require_auth)):
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
                "deleted_at": None,
            }
        )
        .execute()
    )
    return {"category": to_category_dto(resp.data[0])}


@router.patch("/{category_id}")
async def update_category(
    category_id: str, body: UpdateCategory, auth: AuthState = Depends(require_auth)
):
    now = datetime.now(timezone.utc)
    resp = (
        auth.supabase.table("categories")
        .update({"name": body.name.strip(), "color": body.color, "icon": body.icon, "updated_at": now.isoformat()})
        .eq("id", category_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Category not found.")

    return {"category": to_category_dto(resp.data[0])}


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: str, auth: AuthState = Depends(require_auth)):
    now = datetime.now(timezone.utc).isoformat()
    resp = (
        auth.supabase.table("categories")
        .update({"deleted_at": now, "updated_at": now})
        .eq("id", category_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Category not found.")
