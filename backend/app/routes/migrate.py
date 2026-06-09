from fastapi import APIRouter, Header, HTTPException
from app.config import get_settings
from app.supabase_client import get_service_client
from app.encryption import encrypt, decrypt

router = APIRouter(prefix="/admin")

@router.post("/migrate-encrypt")
async def migrate_encrypt(x_service_key: str | None = Header(default=None)):
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured on the server."
        )
        
    if not x_service_key or x_service_key != settings.supabase_service_role_key:
        raise HTTPException(status_code=403, detail="Forbidden. Invalid service key.")

    client = get_service_client()
    stats = {
        "tasks": {"processed": 0, "migrated": 0},
        "notes": {"processed": 0, "migrated": 0},
        "habits": {"processed": 0, "migrated": 0},
        "categories": {"processed": 0, "migrated": 0},
    }

    # Helper function to migrate a table
    def migrate_table(table_name: str, fields_to_encrypt: list[str]):
        # Fetch all rows from table
        # Since we use service role client, we bypass RLS and get all rows
        resp = client.table(table_name).select("*").execute()
        rows = resp.data or []
        stats[table_name]["processed"] = len(rows)

        for row in rows:
            row_id = row["id"]
            updated_payload = {}
            
            for field in fields_to_encrypt:
                val = row.get(field)
                if val and isinstance(val, str):
                    # Check if it is plaintext
                    if decrypt(val) == val:
                        updated_payload[field] = encrypt(val)

            if updated_payload:
                # Update the row in-place
                client.table(table_name).update(updated_payload).eq("id", row_id).execute()
                stats[table_name]["migrated"] += 1

    # Migrate each of the four tables
    try:
        migrate_table("tasks", ["title", "description"])
        migrate_table("notes", ["heading", "content_rich", "content_plain"])
        migrate_table("habits", ["title"])
        migrate_table("categories", ["name"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Migration failed mid-process: {str(exc)}")

    return {
        "status": "success",
        "message": "Migration completed successfully.",
        "details": stats
    }
