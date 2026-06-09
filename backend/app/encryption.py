import base64
from cryptography.fernet import Fernet
from app.config import get_settings

_fernet_instance = None

def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        settings = get_settings()
        # Ensure the key is valid bytes
        key = settings.encryption_key.strip().encode("utf-8")
        _fernet_instance = Fernet(key)
    return _fernet_instance

def encrypt(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

def decrypt(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, str):
        return ciphertext
    
    fernet = _get_fernet()
    try:
        # Try to decrypt. If it succeeds, return the decrypted string.
        # If it's not a valid Fernet token, it will raise cryptography.fernet.InvalidToken or ValueError.
        return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback to returning original ciphertext if it is plaintext (legacy data)
        return ciphertext

def encrypt_fields(data: dict[str, any], fields: list[str]) -> dict[str, any]:
    copied = dict(data)
    for field in fields:
        if field in copied and copied[field] is not None:
            copied[field] = encrypt(copied[field])
    return copied

def decrypt_fields(data: dict[str, any], fields: list[str]) -> dict[str, any]:
    copied = dict(data)
    for field in fields:
        if field in copied and copied[field] is not None:
            copied[field] = decrypt(copied[field])
    return copied
