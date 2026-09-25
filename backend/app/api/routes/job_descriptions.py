"""CareerAI job description routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_verified_user
from app.core.database import get_db
from app.models.models import JobDescription, User
from app.schemas.schemas import CreateJDRequest, JDResponse

router = APIRouter(prefix="/job-descriptions", tags=["Job Descriptions"])


@router.post("", response_model=JDResponse, status_code=201)
async def create_jd(
    payload: CreateJDRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    jd = JobDescription(
        user_id=current_user.id,
        title=payload.title,
        company=payload.company,
        content=payload.content,
    )
    db.add(jd)
    await db.flush()
    return jd


@router.get("", response_model=list[JDResponse])
async def list_jds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.user_id == current_user.id)
        .order_by(JobDescription.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{jd_id}", response_model=JDResponse)
async def get_jd(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")
    return jd


@router.delete("/{jd_id}", status_code=204)
async def delete_jd(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")
    await db.delete(jd)
