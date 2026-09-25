"""
CareerAI analysis pipeline orchestrator.
Runs the full AI pipeline as a background task:
  Resume parse → JD parse → Embeddings → Skill gap → ATS →
  Projects → Technical Interview → HR Interview → Roadmap → Suggestions
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Analysis, AnalysisResult, AnalysisStatus, Interview,
    InterviewType, JobDescription, ProjectRecommendation,
    Resume, RoadmapItem, Skill, AnalysisSkill, SkillMatchStatus,
)
from app.ai.ai_service import (
    build_skill_gap,
    compute_ats_score,
    cosine_similarity,
    extract_jd_structured,
    extract_resume_structured,
    generate_interview_questions,
    generate_projects,
    generate_roadmap,
    generate_resume_suggestions,
    get_embedding,
)
from app.services.resume_parser import extract_text_from_pdf
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _upsert_result(db: AsyncSession, analysis_id: str, section: str, data: dict) -> None:
    """Save or update an analysis result section."""
    result = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.analysis_id == analysis_id,
            AnalysisResult.section == section,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.result_json = data
    else:
        db.add(AnalysisResult(analysis_id=analysis_id, section=section, result_json=data))


async def run_analysis_pipeline(analysis_id: str) -> None:
    """
    Full analysis pipeline. Runs as a background task.
    Uses its own DB session (not the request session which is already closed).
    """
    async with AsyncSessionLocal() as db:
        try:
            await _pipeline(db, analysis_id)
        except Exception as exc:
            logger.error(
                "Analysis pipeline failed",
                extra={"analysis_id": analysis_id, "error_type": type(exc).__name__},
            )
            # Mark analysis as failed
            result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
            analysis = result.scalar_one_or_none()
            if analysis:
                analysis.status = AnalysisStatus.FAILED
                analysis.error_message = f"AI analysis failed: {type(exc).__name__}"
                await db.commit()


async def _pipeline(db: AsyncSession, analysis_id: str) -> None:
    # ── Load analysis + related records ──────────────────────────────────────
    result = await db.execute(
        select(Analysis)
        .where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise ValueError(f"Analysis {analysis_id} not found")

    analysis.status = AnalysisStatus.PROCESSING
    await db.commit()

    # Load resume and JD
    resume_r = await db.execute(select(Resume).where(Resume.id == analysis.resume_id))
    resume = resume_r.scalar_one()

    jd_r = await db.execute(select(JobDescription).where(JobDescription.id == analysis.job_description_id))
    jd = jd_r.scalar_one()

    # ── Step 1: Extract/use parsed resume text ────────────────────────────────
    logger.info("Step 1: Resume parsing", extra={"analysis_id": analysis_id})
    resume_text = resume.parsed_text or ""
    resume_parsed = resume.parsed_metadata or {}
    if not resume_parsed and resume_text:
        resume_parsed = await extract_resume_structured(resume_text)
        resume.parsed_metadata = resume_parsed
        await db.commit()

    # ── Step 2: Parse JD ──────────────────────────────────────────────────────
    logger.info("Step 2: JD parsing", extra={"analysis_id": analysis_id})
    jd_parsed = await extract_jd_structured(jd.content)

    # ── Step 3: Embeddings + semantic similarity ──────────────────────────────
    logger.info("Step 3: Embeddings", extra={"analysis_id": analysis_id})
    semantic_score = 0.5  # fallback if embeddings fail
    try:
        resume_embedding = await get_embedding(resume_text[:4000])
        jd_embedding = await get_embedding(jd.content[:4000])
        semantic_score = cosine_similarity(resume_embedding, jd_embedding)
    except Exception as exc:
        logger.warning("Embedding generation failed, using fallback score", extra={"error_type": type(exc).__name__})

    # ── Step 4: Skill gap ─────────────────────────────────────────────────────
    logger.info("Step 4: Skill gap", extra={"analysis_id": analysis_id})
    skill_gaps = await build_skill_gap(resume_parsed, jd_parsed)
    missing_skills = [g.skill for g in skill_gaps if g.match_status == "missing"]

    # Persist skill data
    for gap in skill_gaps:
        skill_r = await db.execute(select(Skill).where(Skill.name == gap.skill))
        skill_obj = skill_r.scalar_one_or_none()
        if not skill_obj:
            skill_obj = Skill(name=gap.skill, category=gap.category)
            db.add(skill_obj)
            await db.flush()
        match_status_map = {
            "matched": SkillMatchStatus.MATCHED,
            "partial": SkillMatchStatus.PARTIAL,
            "missing": SkillMatchStatus.MISSING,
            "related": SkillMatchStatus.RELATED,
        }
        db.add(AnalysisSkill(
            analysis_id=analysis_id,
            skill_id=skill_obj.id,
            match_status=match_status_map.get(gap.match_status, SkillMatchStatus.MISSING),
            similarity_score=gap.similarity_score,
            evidence=gap.resume_evidence,
        ))

    await _upsert_result(db, analysis_id, "skill_gap", {"gaps": [g.model_dump() for g in skill_gaps]})
    await db.commit()

    # ── Step 5: ATS analysis ──────────────────────────────────────────────────
    logger.info("Step 5: ATS analysis", extra={"analysis_id": analysis_id})
    ats = compute_ats_score(resume_parsed, jd_parsed, semantic_score)
    analysis.overall_score = ats.overall_score
    await _upsert_result(db, analysis_id, "ats", ats.model_dump())
    await db.commit()

    # ── Step 6: Project recommendations ──────────────────────────────────────
    logger.info("Step 6: Projects", extra={"analysis_id": analysis_id})
    projects = await generate_projects(resume_parsed, jd_parsed, missing_skills)
    for p in projects:
        db.add(ProjectRecommendation(
            analysis_id=analysis_id,
            title=p.title,
            reason=p.reason,
            skills=p.skills,
            technology=p.technology,
            difficulty=p.difficulty,
            learning_outcome=p.learning_outcome,
            resume_bullet=p.resume_bullet,
        ))
    await _upsert_result(db, analysis_id, "projects", {"projects": [p.model_dump() for p in projects]})
    await db.commit()

    # ── Step 7: Technical interview ───────────────────────────────────────────
    logger.info("Step 7: Technical interview", extra={"analysis_id": analysis_id})
    tech_questions = await generate_interview_questions(resume_parsed, jd_parsed, "technical", 8)
    for q in tech_questions:
        db.add(Interview(
            analysis_id=analysis_id,
            type=InterviewType.TECHNICAL,
            question=q.question,
            answer=q.expected_answer,
            explanation=q.explanation,
            difficulty=q.difficulty,
            topic=q.topic,
        ))
    await _upsert_result(db, analysis_id, "technical_interview", {"questions": [q.model_dump() for q in tech_questions]})
    await db.commit()

    # ── Step 8: HR interview ──────────────────────────────────────────────────
    logger.info("Step 8: HR interview", extra={"analysis_id": analysis_id})
    hr_questions = await generate_interview_questions(resume_parsed, jd_parsed, "hr", 6)
    for q in hr_questions:
        db.add(Interview(
            analysis_id=analysis_id,
            type=InterviewType.HR,
            question=q.question,
            answer=q.expected_answer,
            explanation=q.explanation,
            difficulty=q.difficulty,
            topic=q.topic,
        ))
    await _upsert_result(db, analysis_id, "hr_interview", {"questions": [q.model_dump() for q in hr_questions]})
    await db.commit()

    # ── Step 9: Learning roadmap ──────────────────────────────────────────────
    logger.info("Step 9: Roadmap", extra={"analysis_id": analysis_id})
    roadmap = await generate_roadmap(resume_parsed, jd_parsed, missing_skills)
    for item in roadmap:
        db.add(RoadmapItem(
            analysis_id=analysis_id,
            week=item.week,
            skill=item.skill,
            topic=item.topic,
            objective=item.objective,
            practice_task=item.practice_task,
            project_task=item.project_task,
        ))
    await _upsert_result(db, analysis_id, "roadmap", {"weeks": [item.model_dump() for item in roadmap]})
    await db.commit()

    # ── Step 10: Resume suggestions ───────────────────────────────────────────
    logger.info("Step 10: Resume suggestions", extra={"analysis_id": analysis_id})
    suggestions = await generate_resume_suggestions(resume_parsed, jd_parsed, missing_skills)
    await _upsert_result(db, analysis_id, "resume_suggestions", {"suggestions": [s.model_dump() for s in suggestions]})

    # ── Mark complete ─────────────────────────────────────────────────────────
    analysis.status = AnalysisStatus.COMPLETED
    analysis.completed_at = _utcnow()
    await db.commit()
    logger.info("Analysis pipeline completed", extra={"analysis_id": analysis_id, "score": analysis.overall_score})
