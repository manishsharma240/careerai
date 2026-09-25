"""
CareerAI admin routes — protected by server-side role check only.
Non-admin requests return 404 (not 403) to avoid leaking route existence.
Raw resume file content is NOT exposed to admins — only metadata.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_admin_user
from app.core.database import get_db
from app.models.models import (
    Analysis, AnalysisStatus, Resume, SecurityEvent,
    User, AnalysisResult
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _utcnow():
    return datetime.now(timezone.utc)


# ── Response models ───────────────────────────────────────────────────────────

class AdminUserRow(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    email_verified: bool
    is_active: bool
    auth_provider: str
    created_at: datetime
    last_login_at: Optional[datetime]
    analysis_count: int = 0
    model_config = {"from_attributes": True}


class AdminAnalysisRow(BaseModel):
    id: str
    user_email: str
    status: str
    overall_score: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]
    model_config = {"from_attributes": True}


class AdminSecurityEventRow(BaseModel):
    id: str
    event_type: str
    severity: str
    user_id: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class AdminStatsResponse(BaseModel):
    total_users: int
    verified_users: int
    total_analyses: int
    completed_analyses: int
    failed_analyses: int
    analyses_last_24h: int
    total_resumes: int


class AdminAIUsageRow(BaseModel):
    analysis_id: str
    section: str
    created_at: datetime
    updated_at: datetime


# ── Dashboard stats ───────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    """Aggregate dashboard stats for the admin panel."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    verified_users = (await db.execute(
        select(func.count(User.id)).where(User.email_verified == True)
    )).scalar_one()
    total_analyses = (await db.execute(select(func.count(Analysis.id)))).scalar_one()
    completed = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.COMPLETED)
    )).scalar_one()
    failed = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.FAILED)
    )).scalar_one()
    since_24h = _utcnow() - timedelta(hours=24)
    recent = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.created_at >= since_24h)
    )).scalar_one()
    total_resumes = (await db.execute(
        select(func.count(Resume.id)).where(Resume.deleted_at.is_(None))
    )).scalar_one()

    return AdminStatsResponse(
        total_users=total_users,
        verified_users=verified_users,
        total_analyses=total_analyses,
        completed_analyses=completed,
        failed_analyses=failed,
        analyses_last_24h=recent,
        total_resumes=total_resumes,
    )


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserRow])
async def admin_list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    offset = (page - 1) * page_size
    q = select(User).order_by(desc(User.created_at)).offset(offset).limit(page_size)
    if search:
        q = q.where(User.email.ilike(f"%{search}%"))

    result = await db.execute(q)
    users = result.scalars().all()

    rows = []
    for u in users:
        count = (await db.execute(
            select(func.count(Analysis.id)).where(Analysis.user_id == u.id)
        )).scalar_one()
        rows.append(AdminUserRow(
            id=u.id, email=u.email, full_name=u.full_name, role=u.role,
            email_verified=u.email_verified, is_active=u.is_active,
            auth_provider=u.auth_provider, created_at=u.created_at,
            last_login_at=u.last_login_at, analysis_count=count,
        ))
    return rows


# ── Analyses ──────────────────────────────────────────────────────────────────

@router.get("/analyses", response_model=list[AdminAnalysisRow])
async def admin_list_analyses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    offset = (page - 1) * page_size
    q = (
        select(Analysis, User.email)
        .join(User, Analysis.user_id == User.id)
        .order_by(desc(Analysis.created_at))
        .offset(offset).limit(page_size)
    )
    if status_filter:
        q = q.where(Analysis.status == status_filter)

    result = await db.execute(q)
    rows = result.all()
    return [
        AdminAnalysisRow(
            id=a.id, user_email=email, status=a.status,
            overall_score=a.overall_score,
            created_at=a.created_at, completed_at=a.completed_at,
        )
        for a, email in rows
    ]


# ── Security events ───────────────────────────────────────────────────────────

@router.get("/security", response_model=list[AdminSecurityEventRow])
async def admin_security_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    severity: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    offset = (page - 1) * page_size
    q = select(SecurityEvent).order_by(desc(SecurityEvent.created_at)).offset(offset).limit(page_size)
    if severity:
        q = q.where(SecurityEvent.severity == severity)
    if event_type:
        q = q.where(SecurityEvent.event_type == event_type)

    result = await db.execute(q)
    events = result.scalars().all()
    return [
        AdminSecurityEventRow(
            id=e.id, event_type=e.event_type, severity=e.severity,
            user_id=e.user_id, created_at=e.created_at,
        )
        for e in events
    ]


# ── AI usage ──────────────────────────────────────────────────────────────────

@router.get("/ai-usage", response_model=list[AdminAIUsageRow])
async def admin_ai_usage(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    """Show recent AI result generation events (by section) for cost monitoring."""
    offset = (page - 1) * page_size
    result = await db.execute(
        select(AnalysisResult)
        .order_by(desc(AnalysisResult.updated_at))
        .offset(offset).limit(page_size)
    )
    rows = result.scalars().all()
    return [
        AdminAIUsageRow(
            analysis_id=r.analysis_id,
            section=r.section,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
