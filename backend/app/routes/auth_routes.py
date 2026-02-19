from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.supabase_client import get_public_client, get_service_client

router = APIRouter(prefix="/auth")


class Credentials(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=6, max_length=100)


class RegisterPayload(Credentials):
    displayName: str = Field(min_length=1, max_length=60)


class ChangePasswordPayload(BaseModel):
    newPassword: str = Field(min_length=6, max_length=100)


def _to_auth_user(user) -> dict:
    metadata = user.user_metadata or user.raw_user_meta_data or {}
    display_name = metadata.get("display_name") if isinstance(metadata, dict) else None
    if not display_name:
        email = user.email or ""
        display_name = email.split("@")[0] if "@" in email else ""

    return {
        "id": user.id,
        "email": user.email or "",
        "created_at": (user.created_at or ""),
        "display_name": display_name,
    }


@router.post("/register", status_code=201)
async def register(body: RegisterPayload):
    client = get_public_client()
    try:
        resp = client.auth.sign_up(
            {
                "email": body.email,
                "password": body.password,
                "options": {
                    "data": {
                        "display_name": body.displayName.strip(),
                    }
                },
            }
        )
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


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordPayload, auth: AuthState = Depends(require_auth)):
    try:
        auth.supabase.auth.update_user({"password": body.newPassword})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/delete-account", status_code=204)
async def delete_account(auth: AuthState = Depends(require_auth)):
    try:
        service_client = get_service_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        service_client.auth.admin.delete_user(auth.user_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
