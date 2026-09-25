"""
CareerAI security utilities.
Handles password hashing (Argon2id), JWT tokens, OTP generation, and IP hashing.
Secrets NEVER appear in logs or responses.
"""
import hashlib
import hmac
import os
import secrets
import string
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing (Argon2id preferred, bcrypt fallback) ────────────────────
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
    argon2__memory_cost=65536,   # 64 MB
    argon2__time_cost=3,
    argon2__parallelism=4,
)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def needs_rehash(hashed: str) -> bool:
    return pwd_context.needs_update(hashed)


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


def hash_otp(otp: str) -> str:
    """SHA-256 hash the OTP before storing — we never store it plaintext."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp(plain: str, stored_hash: str) -> bool:
    candidate = hashlib.sha256(plain.encode()).hexdigest()
    return hmac.compare_digest(candidate, stored_hash)


# ── IP hashing (HMAC-SHA256) ──────────────────────────────────────────────────

def hash_ip(ip: str) -> str:
    """One-way HMAC of the IP so we can detect duplicates without storing raw IPs."""
    return hmac.new(
        settings.JWT_SECRET.encode(),
        ip.encode(),
        hashlib.sha256,
    ).hexdigest()


# ── JWT ───────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str, role: str) -> str:
    expire = _now() + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "iat": _now(),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    """Opaque refresh token — stored hashed in sessions table."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises JWTError on any validation failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise


# ── Password reset token ──────────────────────────────────────────────────────

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


# ── Secure filename ───────────────────────────────────────────────────────────

def safe_storage_key(user_id: str, original_ext: str) -> str:
    """Generate a random storage key; original filename is never used in path."""
    rand = secrets.token_hex(16)
    return f"{user_id}/{rand}{original_ext}"
