"""
CareerAI Google OAuth 2.0 / OpenID Connect.

Security requirements enforced here (never trust the frontend or a raw ID token):
- Authorization code exchanged for tokens server-side only (client secret never leaves backend)
- ID token signature verified against Google's published public keys (via google-auth)
- issuer (iss) checked to be accounts.google.com or https://accounts.google.com
- audience (aud) checked to match our own GOOGLE_CLIENT_ID
- expiry (exp) checked by the verification library
- CSRF `state` parameter generated per attempt and validated on callback
"""
import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# In-memory state store for CSRF protection on the OAuth flow.
# A short-lived, single-use nonce is enough here since the whole flow completes
# within the same browser session in under a minute. For a multi-instance
# production deployment this would move to Redis (see README).
_pending_states: dict[str, bool] = {}


def is_google_oauth_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def build_google_auth_url() -> str:
    """Build the URL to redirect the user to Google's consent screen."""
    if not is_google_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this server.",
        )
    state = secrets.token_urlsafe(24)
    _pending_states[state] = True

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


def consume_state(state: str) -> bool:
    """Validate and invalidate a one-time OAuth state token (CSRF protection)."""
    return _pending_states.pop(state, False)


async def exchange_code_for_identity(code: str) -> dict:
    """
    Exchange the authorization code for tokens, then verify the ID token
    server-side. Returns the verified claims dict (sub, email, name, ...).
    Raises HTTPException on any verification failure.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            token_response = await client.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
        except httpx.HTTPError as exc:
            logger.error("Google token exchange network error", extra={"error_type": type(exc).__name__})
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Google. Please try again.")

    if token_response.status_code != 200:
        logger.warning("Google token exchange rejected", extra={"status": token_response.status_code})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google sign-in failed. Please try again.")

    tokens = token_response.json()
    raw_id_token = tokens.get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google sign-in failed. Please try again.")

    try:
        # google-auth verifies signature against Google's live public keys,
        # AND checks audience == our client ID, AND checks expiry.
        claims = google_id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            audience=settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        # Covers: bad signature, expired token, audience mismatch, wrong issuer
        logger.warning("Google ID token verification failed", extra={"error": str(exc)})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify Google identity.")

    # Explicit issuer allowlist even though the library also checks this
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify Google identity.")

    if not claims.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your Google account's email is not verified.",
        )

    return claims
