from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.supabase_client import get_public_client

router = APIRouter(prefix="/auth")


class Credentials(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=6, max_length=100)


def _to_auth_user(user) -> dict:
    return {
        "id": user.id,
        "email": user.email or "",
        "created_at": (user.created_at or ""),
    }


@router.post("/register", status_code=201)
async def register(body: Credentials):
    client = get_public_client()
    try:
        resp = client.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not resp.user:
        raise HTTPException(status_code=500, detail="Registration failed.")

    return {
        "user": _to_auth_user(resp.user),
        "token": resp.session.access_token if resp.session else None,
        "requiresEmailConfirmation": resp.session is None,
    }


@router.post("/login")
async def login(body: Credentials):
    client = get_public_client()
    try:
        resp = client.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    if not resp.user or not resp.session or not resp.session.access_token:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    return {
        "token": resp.session.access_token,
        "user": _to_auth_user(resp.user),
    }


@router.get("/me")
async def me(auth: AuthState = Depends(require_auth)):
    client = get_public_client()
    try:
        resp = client.auth.get_user(auth.token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not resp or not resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    return {"user": _to_auth_user(resp.user)}
