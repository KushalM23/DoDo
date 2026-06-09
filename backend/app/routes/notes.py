from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.contracts import to_note_dto
from app.encryption import encrypt

router = APIRouter(prefix="/notes")


class CreateNote(BaseModel):
    id: Optional[str] = None
    heading: str = Field(default="", max_length=160)
    contentRich: str = Field(default="")
    contentPlain: str = Field(default="")
    isPinned: bool = False
    pinnedAt: Optional[str] = None


@router.post("", status_code=201)
async def create_note(body: CreateNote, auth: AuthState = Depends(require_auth)):
    now = datetime.now(timezone.utc).isoformat()
    pinned_at = body.pinnedAt
    if body.isPinned and not pinned_at:
        pinned_at = now
    if not body.isPinned:
        pinned_at = None

    resp = (
        auth.supabase.table("notes")
        .insert(
            {
                **({"id": body.id} if body.id else {}),
                "user_id": auth.user_id,
                "heading": encrypt(body.heading.strip()),
                "content_rich": encrypt(body.contentRich),
                "content_plain": encrypt(body.contentPlain),
                "is_pinned": body.isPinned,
                "pinned_at": pinned_at,
                "updated_at": now,
                "deleted_at": None,
            }
        )
        .execute()
    )
    return {"note": to_note_dto(resp.data[0])}


_FIELD_MAP = {
    "heading": "heading",
    "contentRich": "content_rich",
    "contentPlain": "content_plain",
    "isPinned": "is_pinned",
    "pinnedAt": "pinned_at",
}


@router.patch("/{note_id}")
async def update_note(note_id: str, request: Request, auth: AuthState = Depends(require_auth)):
    raw: dict[str, Any] = await request.json()

    if not raw:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    payload: dict[str, Any] = {}
    for camel, snake in _FIELD_MAP.items():
        if camel in raw:
            payload[snake] = raw[camel]

    if "heading" in payload and isinstance(payload["heading"], str):
        payload["heading"] = encrypt(payload["heading"].strip())
    if "content_rich" in payload and isinstance(payload["content_rich"], str):
        payload["content_rich"] = encrypt(payload["content_rich"])
    if "content_plain" in payload and isinstance(payload["content_plain"], str):
        payload["content_plain"] = encrypt(payload["content_plain"])

    now = datetime.now(timezone.utc).isoformat()
    if "is_pinned" in payload:
        is_pinned = bool(payload["is_pinned"])
        payload["is_pinned"] = is_pinned
        if is_pinned and "pinned_at" not in payload:
            payload["pinned_at"] = now
        if not is_pinned:
            payload["pinned_at"] = None

    if not payload:
        raise HTTPException(status_code=400, detail="At least one field is required.")

    payload["updated_at"] = now

    resp = (
        auth.supabase.table("notes")
        .update(payload)
        .eq("id", note_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Note not found.")

    return {"note": to_note_dto(resp.data[0])}


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: str, auth: AuthState = Depends(require_auth)):
    resp = (
        auth.supabase.table("notes")
        .delete()
        .eq("id", note_id)
        .eq("user_id", auth.user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Note not found.")
