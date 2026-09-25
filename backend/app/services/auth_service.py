"""
CareerAI authentication service layer.
All token operations use hashed values — plain tokens/OTPs are never stored.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import (
    EmailVerificationToken,
    PasswordResetToken,
    Session,
    SecurityEvent,
    SecurityEventSeverity,
    User,
    UserRole,
    AuthProvider,
)
from app.schemas.schemas import (
    SignupRequest,
    LoginRequest,
    TokenResponse,
    VerifyOTPRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.security.crypto import (
    hash_password,
    verify_password,
    generate_otp,
    hash_otp,
    verify_otp,
    create_access_token,
    create_refresh_token,
    hash_token,
    hash_ip,
    generate_reset_token,
)
from app.services.email import send_otp_email, send_password_reset_email

settings = get_settings()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ip_from_request(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _log_security_event(
    db: AsyncSession,
    event_type: str,
    severity: SecurityEventSeverity,
    user_id: Optional[str],
    request: Optional[Request],
    metadata: Optional[dict] = None,
) -> None:
    ip = _ip_from_request(request) if request else None
    event = SecurityEvent(
        user_id=user_id,
        event_type=event_type,
        severity=severity,
        ip_hash=hash_ip(ip) if ip else None,
        user_agent=request.headers.get("User-Agent", "")[:512] if request else None,
        event_metadata=metadata or {},
    )
    db.add(event)


# ── Signup ────────────────────────────────────────────────────────────────────

async def signup(
    db: AsyncSession, payload: SignupRequest, request: Request
) -> dict:
    # Normalize email
    email = payload.email.lower().strip()

    # Check for existing user — don't reveal if email exists via error message
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        # Return the same message to prevent email enumeration
        return {"message": "If this email is not registered, you will receive a verification code."}

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        auth_provider=AuthProvider.EMAIL,
        email_verified=False,
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()  # get user.id before commit

    await _issue_otp(db, user)
    await _log_security_event(
        db, "signup", SecurityEventSeverity.LOW, user.id, request
    )
    return {"message": "If this email is not registered, you will receive a verification code."}


async def _issue_otp(db: AsyncSession, user: User) -> str:
    """Generate, hash, store, and email a new OTP. Invalidates previous tokens."""
    # Invalidate old tokens by marking them used
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(used_at=_utcnow())
    )

    otp = generate_otp()
    token = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_otp(otp),
        expires_at=_utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        attempts=0,
    )
    db.add(token)
    await db.flush()

    # Send email — if this fails the transaction rolls back
    await send_otp_email(user.email, user.full_name, otp)
    return otp


# ── OTP Verification ──────────────────────────────────────────────────────────

async def verify_email_otp(
    db: AsyncSession, payload: VerifyOTPRequest, request: Request
) -> dict:
    email = payload.email.lower().strip()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    if user.email_verified:
        return {"message": "Email already verified. Please log in."}

    # Fetch the latest active token
    token_result = await db.execute(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
    )
    token = token_result.scalar_one_or_none()

    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    # Increment attempt count
    token.attempts += 1

    if token.attempts > settings.OTP_MAX_ATTEMPTS:
        await _log_security_event(
            db, "otp_max_attempts", SecurityEventSeverity.MEDIUM, user.id, request
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new code.",
        )

    if token.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code has expired. Please request a new one.")

    if not verify_otp(payload.otp, token.token_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code.")

    # Mark token used
    token.used_at = _utcnow()
    user.email_verified = True
    await _log_security_event(
        db, "email_verified", SecurityEventSeverity.LOW, user.id, request
    )
    return {"message": "Email verified successfully. You can now log in."}


async def resend_otp(db: AsyncSession, email: str, request: Request) -> dict:
    email = email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Check cooldown regardless of whether user exists (prevents enumeration)
    if user and not user.email_verified:
        # Check last token creation time for cooldown
        token_result = await db.execute(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user.id)
            .order_by(EmailVerificationToken.created_at.desc())
        )
        last_token = token_result.scalar_one_or_none()
        if last_token:
            cooldown_end = last_token.created_at + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
            if _utcnow() < cooldown_end:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait before requesting a new code.",
                )
        await _issue_otp(db, user)

    return {"message": "If your email is registered and unverified, a new code has been sent."}


# ── Login ─────────────────────────────────────────────────────────────────────

async def login(
    db: AsyncSession, payload: LoginRequest, request: Request
) -> TokenResponse:
    email = payload.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Constant-time-ish check to prevent timing attacks
    dummy_hash = "$argon2id$v=19$m=65536,t=3,p=4$dummy"
    if user and user.password_hash:
        valid = verify_password(payload.password, user.password_hash)
    else:
        verify_password("dummy", dummy_hash)
        valid = False

    if not user or not valid:
        await _log_security_event(
            db, "login_failed", SecurityEventSeverity.MEDIUM,
            user.id if user else None, request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in.",
        )

    return await _create_session(db, user, request)


async def _create_session(db: AsyncSession, user: User, request: Request) -> TokenResponse:
    refresh_token = create_refresh_token()
    access_token = create_access_token(user.id, user.role)

    ip = _ip_from_request(request)
    session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        user_agent=request.headers.get("User-Agent", "")[:512],
        ip_hash=hash_ip(ip),
        expires_at=_utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )
    db.add(session)
    user.last_login_at = _utcnow()

    await _log_security_event(
        db, "login_success", SecurityEventSeverity.LOW, user.id, request
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

async def refresh_tokens(
    db: AsyncSession, refresh_token: str, request: Request
) -> TokenResponse:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.revoked_at.is_(None),
            Session.expires_at > _utcnow(),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")

    # Rotate: revoke old session, issue new tokens
    session.revoked_at = _utcnow()
    return await _create_session(db, user, request)


# ── Logout ────────────────────────────────────────────────────────────────────

async def logout(db: AsyncSession, refresh_token: str, user: User) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session:
        session.revoked_at = _utcnow()


async def logout_all(db: AsyncSession, user: User, except_token: Optional[str] = None) -> None:
    sessions_result = await db.execute(
        select(Session).where(
            Session.user_id == user.id,
            Session.revoked_at.is_(None),
        )
    )
    sessions = sessions_result.scalars().all()
    keep_hash = hash_token(except_token) if except_token else None
    for s in sessions:
        if keep_hash and s.refresh_token_hash == keep_hash:
            continue
        s.revoked_at = _utcnow()


# ── Password Reset ────────────────────────────────────────────────────────────

async def forgot_password(db: AsyncSession, email: str, request: Request) -> dict:
    email = email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and user.auth_provider == AuthProvider.EMAIL:
        token = generate_reset_token()
        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=_utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        )
        db.add(reset_record)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        await send_password_reset_email(user.email, user.full_name, reset_url)

    # Always return the same message to prevent email enumeration
    return {"message": "If this email is registered, a password reset link has been sent."}


async def reset_password(
    db: AsyncSession, payload: ResetPasswordRequest, request: Request
) -> dict:
    token_hash = hash_token(payload.token)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > _utcnow(),
        )
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link.",
        )

    user_result = await db.execute(select(User).where(User.id == token_record.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request.")

    token_record.used_at = _utcnow()
    user.password_hash = hash_password(payload.new_password)

    # Revoke all sessions after password change
    await logout_all(db, user)
    await _log_security_event(
        db, "password_reset", SecurityEventSeverity.MEDIUM, user.id, request
    )
    return {"message": "Password reset successfully. Please log in with your new password."}


# ── Google OAuth ──────────────────────────────────────────────────────────────

async def login_or_register_google_user(
    db: AsyncSession, claims: dict, request: Request
) -> TokenResponse:
    """
    Find or create a user from verified Google ID token claims.
    claims is already verified (signature, issuer, audience, expiry) by
    app.auth.google_oauth.exchange_code_for_identity — never call this with
    unverified data.
    """
    google_sub = claims["sub"]
    email = claims["email"].lower().strip()
    full_name = claims.get("name")

    # Look up by google_subject_id first (stable identifier across email changes)
    result = await db.execute(select(User).where(User.google_subject_id == google_sub))
    user = result.scalar_one_or_none()

    if not user:
        # Fall back to matching by email — links an existing email/password
        # account to Google sign-in rather than creating a duplicate account.
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            user.google_subject_id = google_sub
            if user.auth_provider == AuthProvider.EMAIL and not user.password_hash:
                user.auth_provider = AuthProvider.GOOGLE
        else:
            user = User(
                email=email,
                full_name=full_name,
                password_hash=None,
                auth_provider=AuthProvider.GOOGLE,
                google_subject_id=google_sub,
                email_verified=True,  # Google already verified this
                role=UserRole.USER,
            )
            db.add(user)
            await db.flush()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    await _log_security_event(
        db, "google_login_success", SecurityEventSeverity.LOW, user.id, request
    )
    return await _create_session(db, user, request)
