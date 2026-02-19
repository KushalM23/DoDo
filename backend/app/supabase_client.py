from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import get_settings


def get_public_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key)


def get_client_for_token(token: str) -> Client:
    s = get_settings()
    opts = ClientOptions(
        headers={"Authorization": f"Bearer {token}"},
        auto_refresh_token=False,
        persist_session=False,
    )
    return create_client(s.supabase_url, s.supabase_anon_key, options=opts)


def get_service_client() -> Client:
    s = get_settings()
    if not s.supabase_service_role_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for this operation.")
    return create_client(s.supabase_url, s.supabase_service_role_key)
