"""
CareerAI user + session routes.
GET /me, PATCH /me, POST /me/password, DELETE /me
GET /sessions, DELETE /sessions/{id}
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_verified_user
from app.core.database import get_db
from app.models.models import Session, User
from app.schemas.schemas import UserResponse
from app.security.crypto import hash_password, verify_password

router = APIRouter(tags=["Users & Sessions"])


def _utcnow():
    return datetime.now(timezone.utc)


# ── /me ───────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None
    return current_user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/me/password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is not available for OAuth accounts.",
        )
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    current_user.password_hash = hash_password(payload.new_password)
    # Revoke all sessions after password change
    sessions_result = await db.execute(
        select(Session).where(Session.user_id == current_user.id, Session.revoked_at.is_(None))
    )
    for s in sessions_result.scalars().all():
        s.revoked_at = _utcnow()
    return {"message": "Password changed. All other sessions have been logged out."}


@router.delete("/me", status_code=204)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Permanently delete the authenticated user's account and all data."""
    await db.delete(current_user)


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: str
    user_agent: Optional[str]
    created_at: datetime
    last_seen_at: datetime
    is_current: bool

    model_config = {"from_attributes": True}


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session).where(
            Session.user_id == current_user.id,
            Session.revoked_at.is_(None),
            Session.expires_at > _utcnow(),
        ).order_by(Session.last_seen_at.desc())
    )
    sessions = result.scalars().all()
    # Mark the most-recently-seen as current (best proxy without passing the token)
    return [
        SessionResponse(
            id=s.id,
            user_agent=s.user_agent,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            is_current=(i == 0),
        )
        for i, s in enumerate(sessions)
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == current_user.id,  # ownership check
            Session.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    session.revoked_at = _utcnow()
