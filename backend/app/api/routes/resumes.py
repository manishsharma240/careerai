"""
CareerAI resume routes.
File validation happens server-side. Storage keys are random. No public URLs.
"""
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_verified_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import Resume, User
from app.schemas.schemas import ResumeResponse
from app.services.file_service import (
    compute_file_hash,
    generate_storage_key,
    sanitize_display_filename,
    validate_resume_upload,
)
from app.services.resume_parser import extract_resume_text
from app.ai.ai_service import extract_resume_structured

settings = get_settings()
router = APIRouter(prefix="/resumes", tags=["Resumes"])


def _utcnow():
    return datetime.now(timezone.utc)


def _storage_path(storage_key: str) -> str:
    return os.path.join(settings.STORAGE_LOCAL_DIR, storage_key)


async def _save_file_locally(content: bytes, storage_key: str) -> None:
    path = _storage_path(storage_key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


@router.post("/upload", response_model=ResumeResponse, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Upload a resume (PDF or DOCX). Validates extension, size, and format
    signature. Stores the file with a random key — the original filename is
    never used in storage.
    """
    content, ext = await validate_resume_upload(file)
    file_hash = compute_file_hash(content)

    # Check for duplicate (same hash, same user) — return existing
    dup_result = await db.execute(
        select(Resume).where(
            Resume.user_id == current_user.id,
            Resume.file_hash == file_hash,
            Resume.deleted_at.is_(None),
        )
    )
    existing = dup_result.scalar_one_or_none()
    if existing:
        return existing

    storage_key = generate_storage_key(current_user.id, ext)
    await _save_file_locally(content, storage_key)

    # Extract text for later AI use — dispatches to PDF or DOCX extractor
    parsed_text = extract_resume_text(content, ext)
    # Pre-parse the resume so analysis pipeline is faster
    parsed_meta = {}
    if parsed_text:
        try:
            parsed_meta = await extract_resume_structured(parsed_text)
        except Exception:
            pass  # pipeline will retry

    resume = Resume(
        user_id=current_user.id,
        filename=sanitize_display_filename(file.filename or f"resume{ext}"),
        storage_key=storage_key,
        file_size=len(content),
        file_hash=file_hash,
        parsed_text=parsed_text,
        parsed_metadata=parsed_meta,
    )
    db.add(resume)
    await db.flush()
    return resume


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(Resume).where(
            Resume.user_id == current_user.id,
            Resume.deleted_at.is_(None),
        ).order_by(Resume.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,  # ownership check
            Resume.deleted_at.is_(None),
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
    return resume


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
            Resume.deleted_at.is_(None),
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
    resume.deleted_at = _utcnow()
