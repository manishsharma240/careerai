"""
CareerAI API routes — auth endpoints.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.google_oauth import (
    build_google_auth_url,
    consume_state,
    exchange_code_for_identity,
    is_google_oauth_configured,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.schemas import (
    ForgotPasswordRequest, LoginRequest, MessageResponse,
    RefreshRequest, ResetPasswordRequest, ResendOTPRequest,
    SignupRequest, TokenResponse, VerifyOTPRequest,
)
from app.services import auth_service

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=MessageResponse, status_code=201)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.signup(db, payload, request)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(payload: VerifyOTPRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.verify_email_otp(db, payload, request)


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(payload: ResendOTPRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.resend_otp(db, payload.email, request)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(db, payload, request)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_tokens(db, payload.refresh_token, request)


@router.post("/logout", response_model=MessageResponse)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db),
                 user=Depends(get_current_user)):
    await auth_service.logout(db, payload.refresh_token, user)
    return {"message": "Logged out successfully."}


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.forgot_password(db, payload.email, request)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await auth_service.reset_password(db, payload, request)


@router.get("/google")
async def google_login():
    """
    Redirect the user to Google's OAuth consent screen.
    If Google OAuth credentials are not configured, redirect back to the
    frontend login page with a clear error rather than pretending this works.
    """
    if not is_google_oauth_configured():
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=google_not_configured"
        )
    auth_url = build_google_auth_url()
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Google redirects here after the user consents (or denies).
    On success, issues our own access + refresh tokens and redirects to the
    frontend callback page with them as URL fragments (never query params,
    which get logged by servers and proxies).
    """
    if error:
        # User denied consent or Google returned an error
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=google_denied")

    if not code or not state or not consume_state(state):
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=google_invalid_state")

    claims = await exchange_code_for_identity(code)
    tokens = await auth_service.login_or_register_google_user(db, claims, request)

    # Tokens go in the URL fragment (#), which browsers never send to the
    # server on subsequent requests and which server access logs never record.
    redirect_url = (
        f"{settings.FRONTEND_URL}/auth/callback"
        f"#access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )
    return RedirectResponse(url=redirect_url)
