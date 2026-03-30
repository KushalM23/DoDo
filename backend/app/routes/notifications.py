from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthState, require_auth

router = APIRouter(prefix='/notifications')


class UpsertPushTokenPayload(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    platform: Literal['android', 'ios']
    deviceId: str | None = Field(default=None, min_length=1, max_length=255)
    appVersion: str | None = Field(default=None, min_length=1, max_length=50)


class DeletePushTokenPayload(BaseModel):
    token: str = Field(min_length=20, max_length=512)


@router.post('/token', status_code=204)
async def upsert_push_token(
    body: UpsertPushTokenPayload,
    auth: AuthState = Depends(require_auth),
):
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        auth.supabase.table('device_push_tokens').upsert(
            {
                'user_id': auth.user_id,
                'fcm_token': body.token,
                'platform': body.platform,
                'device_id': body.deviceId,
                'app_version': body.appVersion,
                'updated_at': now_iso,
                'disabled_at': None,
            },
            on_conflict='fcm_token',
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete('/token', status_code=204)
async def delete_push_token(
    body: DeletePushTokenPayload,
    auth: AuthState = Depends(require_auth),
):
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        auth.supabase.table('device_push_tokens').update(
            {'disabled_at': now_iso, 'updated_at': now_iso}
        ).eq('user_id', auth.user_id).eq('fcm_token', body.token).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
