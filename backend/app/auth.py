from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from supabase import Client

from app.supabase_client import get_public_client, get_client_for_token


class AuthState:
    def __init__(self, user_id: str, token: str, supabase: Client):
        self.user_id = user_id
        self.token = token
        self.supabase = supabase


async def require_auth(authorization: Annotated[str | None, Header()] = None) -> AuthState:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    token = authorization.removeprefix("Bearer ").strip()
    client = get_public_client()

    try:
        resp = client.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not resp or not resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    return AuthState(
        user_id=resp.user.id,
        token=token,
        supabase=get_client_for_token(token),
    )
