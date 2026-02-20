from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth
from app.progression import progress_from_experience
from app.supabase_client import get_client_for_token, get_public_client, get_service_client

router = APIRouter(prefix="/auth")


class Credentials(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=6, max_length=100)


class RegisterPayload(Credentials):
    displayName: str = Field(min_length=1, max_length=60)


class ChangePasswordPayload(BaseModel):
    newPassword: str = Field(min_length=6, max_length=100)


def _fetch_profile_progress(client, user_id: str) -> dict:
    resp = (
        client.table("profiles")
        .select("experience_points, current_level")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    xp = 0
    if resp.data:
        xp = int(resp.data[0].get("experience_points") or 0)
    return progress_from_experience(xp)


def _to_auth_user(user, profile_progress: dict | None = None) -> dict:
    metadata = user.user_metadata or user.raw_user_meta_data or {}
    display_name = metadata.get("display_name") if isinstance(metadata, dict) else None
    if not display_name:
        email = user.email or ""
        display_name = email.split("@")[0] if "@" in email else ""

    progress = profile_progress or progress_from_experience(0)

    return {
        "id": user.id,
        "email": user.email or "",
        "created_at": (user.created_at or ""),
        "display_name": display_name,
        "experience_points": progress["experiencePoints"],
        "current_level": progress["level"],
        "xp_into_level": progress["xpIntoLevel"],
        "xp_for_next_level": progress["xpForNextLevel"],
        "xp_to_next_level": progress["xpToNextLevel"],
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

    progress = progress_from_experience(0)
    if resp.session and resp.session.access_token:
        try:
            client_for_user = get_client_for_token(resp.session.access_token)
            progress = _fetch_profile_progress(client_for_user, resp.user.id)
        except Exception:
            pass

    return {
        "user": _to_auth_user(resp.user, progress),
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

    progress = progress_from_experience(0)
    try:
        client_for_user = get_client_for_token(resp.session.access_token)
        progress = _fetch_profile_progress(client_for_user, resp.user.id)
    except Exception:
        pass

    return {
        "token": resp.session.access_token,
        "user": _to_auth_user(resp.user, progress),
    }


@router.get("/me")
async def me(auth: AuthState = Depends(require_auth)):
    try:
        resp = auth.supabase.auth.get_user(auth.token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not resp or not resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    progress = progress_from_experience(0)
    try:
        progress = _fetch_profile_progress(auth.supabase, auth.user_id)
    except Exception:
        pass

    return {"user": _to_auth_user(resp.user, progress)}


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
