"""
CareerAI analysis routes.
Analysis runs as a background task — polling endpoint returns status.
Full result is only returned once status == COMPLETED.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_verified_user
from app.core.database import get_db
from app.models.models import Analysis, AnalysisStatus, JobDescription, Resume, User, AnalysisResult
from app.schemas.schemas import (
    AnalysisStatusResponse, CreateAnalysisRequest, FullAnalysisResponse,
    ATSResult, SkillGapItem, ProjectRecommendationItem,
    InterviewQuestion, RoadmapWeek, ResumeSuggestion,
)
from app.ai.pipeline import run_analysis_pipeline

router = APIRouter(prefix="/analyses", tags=["Analyses"])


@router.post("", response_model=AnalysisStatusResponse, status_code=202)
async def create_analysis(
    payload: CreateAnalysisRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Create a new analysis and start the AI pipeline in the background.
    Returns immediately with status=QUEUED. Poll GET /analyses/{id} for status.
    """
    # Ownership checks — prevent IDOR
    resume_r = await db.execute(
        select(Resume).where(Resume.id == payload.resume_id, Resume.user_id == current_user.id, Resume.deleted_at.is_(None))
    )
    if not resume_r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Resume not found.")

    jd_r = await db.execute(
        select(JobDescription).where(JobDescription.id == payload.job_description_id, JobDescription.user_id == current_user.id)
    )
    jd = jd_r.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found.")

    # Deduplication: if there's already a QUEUED or PROCESSING analysis for this combination, return it
    existing_r = await db.execute(
        select(Analysis).where(
            Analysis.user_id == current_user.id,
            Analysis.resume_id == payload.resume_id,
            Analysis.job_description_id == payload.job_description_id,
            Analysis.status.in_([AnalysisStatus.QUEUED, AnalysisStatus.PROCESSING]),
        )
    )
    existing = existing_r.scalar_one_or_none()
    if existing:
        return AnalysisStatusResponse(
            id=existing.id,
            status=existing.status,
            overall_score=existing.overall_score,
            created_at=existing.created_at,
            completed_at=existing.completed_at,
            job_title=jd.title,
            company=jd.company,
        )

    analysis = Analysis(
        user_id=current_user.id,
        resume_id=payload.resume_id,
        job_description_id=payload.job_description_id,
        status=AnalysisStatus.QUEUED,
    )
    db.add(analysis)
    await db.flush()
    analysis_id = analysis.id

    background_tasks.add_task(run_analysis_pipeline, analysis_id)

    return AnalysisStatusResponse(
        id=analysis.id,
        status=analysis.status,
        overall_score=None,
        created_at=analysis.created_at,
        completed_at=None,
        job_title=jd.title,
        company=jd.company,
    )


@router.get("", response_model=list[AnalysisStatusResponse])
async def list_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(Analysis, JobDescription)
        .join(JobDescription, Analysis.job_description_id == JobDescription.id)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
    )
    rows = result.all()
    return [
        AnalysisStatusResponse(
            id=a.id, status=a.status, overall_score=a.overall_score,
            created_at=a.created_at, completed_at=a.completed_at,
            job_title=jd.title, company=jd.company,
        )
        for a, jd in rows
    ]


@router.get("/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Lightweight status polling endpoint — call every 3s during processing."""
    result = await db.execute(
        select(Analysis, JobDescription)
        .join(JobDescription, Analysis.job_description_id == JobDescription.id)
        .where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    a, jd = row
    return AnalysisStatusResponse(
        id=a.id, status=a.status, overall_score=a.overall_score,
        created_at=a.created_at, completed_at=a.completed_at,
        job_title=jd.title, company=jd.company,
    )


@router.get("/{analysis_id}", response_model=FullAnalysisResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Full analysis result. Only available once status == COMPLETED."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail=f"Analysis is {analysis.status}. Please try again shortly.",
        )

    # Load result sections
    sections_r = await db.execute(
        select(AnalysisResult).where(AnalysisResult.analysis_id == analysis_id)
    )
    sections = {r.section: r.result_json for r in sections_r.scalars().all()}

    def _load(key, model, list_key=None):
        data = sections.get(key, {})
        if list_key:
            items = data.get(list_key, [])
            try:
                return [model(**i) for i in items]
            except Exception:
                return []
        try:
            return model(**data) if data else None
        except Exception:
            return None

    return FullAnalysisResponse(
        id=analysis.id,
        status=analysis.status,
        overall_score=analysis.overall_score,
        ats=_load("ats", ATSResult),
        skill_gaps=_load("skill_gap", SkillGapItem, "gaps"),
        projects=_load("projects", ProjectRecommendationItem, "projects"),
        technical_interview=_load("technical_interview", InterviewQuestion, "questions"),
        hr_interview=_load("hr_interview", InterviewQuestion, "questions"),
        roadmap=_load("roadmap", RoadmapWeek, "weeks"),
        resume_suggestions=_load("resume_suggestions", ResumeSuggestion, "suggestions"),
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
    )


@router.get("/{analysis_id}/missing-keywords.txt", response_class=PlainTextResponse)
async def get_missing_keywords_text(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Plain-text report of missing keywords and missing skills — suitable for
    copying straight into a resume editor or downloading as a .txt file.
    Ownership is checked the same way as the JSON result endpoint.
    """
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail=f"Analysis is {analysis.status}. Please try again shortly.",
        )

    sections_r = await db.execute(
        select(AnalysisResult).where(AnalysisResult.analysis_id == analysis_id)
    )
    sections = {r.section: r.result_json for r in sections_r.scalars().all()}
    ats_data = sections.get("ats", {})
    gap_data = sections.get("skill_gap", {})

    missing_keywords = ats_data.get("missing_keywords", [])
    matched_keywords = ats_data.get("matched_keywords", [])
    missing_skills = [
        g["skill"] for g in gap_data.get("gaps", [])
        if g.get("match_status") == "missing"
    ]
    partial_skills = [
        g["skill"] for g in gap_data.get("gaps", [])
        if g.get("match_status") == "partial"
    ]

    lines = [
        "CAREERAI — MISSING KEYWORDS REPORT",
        "=" * 40,
        f"Analysis ID: {analysis.id}",
        f"Overall Match Score: {analysis.overall_score or 'N/A'}/100",
        "",
        "MISSING KEYWORDS (not found in your resume)",
        "-" * 40,
    ]
    lines += [f"- {k}" for k in missing_keywords] if missing_keywords else ["(none detected)"]

    lines += [
        "",
        "MISSING SKILLS (required by the job, not evidenced in your resume)",
        "-" * 40,
    ]
    lines += [f"- {s}" for s in missing_skills] if missing_skills else ["(none detected)"]

    lines += [
        "",
        "PARTIALLY COVERED SKILLS (mentioned but not listed explicitly)",
        "-" * 40,
    ]
    lines += [f"- {s}" for s in partial_skills] if partial_skills else ["(none)"]

    lines += [
        "",
        "MATCHED KEYWORDS (already present in your resume)",
        "-" * 40,
    ]
    lines += [f"- {k}" for k in matched_keywords] if matched_keywords else ["(none detected)"]

    lines += [
        "",
        "=" * 40,
        "Disclaimer: This is a CareerAI estimated analysis based on keyword",
        "alignment, skills and semantic similarity. It does not represent any",
        "employer's actual ATS scoring system.",
    ]

    return "\n".join(lines)


@router.delete("/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    await db.delete(analysis)
