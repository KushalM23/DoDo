from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix="/categories")


def _to_category_dto(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "createdAt": row["created_at"],
    }


class CreateCategory(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class UpdateCategory(BaseModel):
    name: str = Field(min_length=1, max_length=50)


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
    resp = (
        auth.supabase.table("categories")
        .insert({"user_id": auth.user_id, "name": body.name.strip()})
        .execute()
    )
    return {"category": _to_category_dto(resp.data[0])}


@router.patch("/{category_id}")
async def update_category(
    category_id: str, body: UpdateCategory, auth: AuthState = Depends(require_auth)
):
    resp = (
        auth.supabase.table("categories")
        .update({"name": body.name.strip()})
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
