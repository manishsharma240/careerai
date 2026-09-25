"""
CareerAI database models — PostgreSQL via SQLAlchemy 2.0.
All tables follow the schema defined in the project specification (section 13).
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Integer, String, Text, Float, JSON, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    USER = "user"
    ADMIN = "admin"


class AuthProvider(str, PyEnum):
    EMAIL = "email"
    GOOGLE = "google"


class AnalysisStatus(str, PyEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SkillMatchStatus(str, PyEnum):
    MATCHED = "matched"
    PARTIAL = "partial"
    MISSING = "missing"
    RELATED = "related"


class SecurityEventSeverity(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InterviewType(str, PyEnum):
    TECHNICAL = "technical"
    HR = "hr"


class SkillImportance(str, PyEnum):
    REQUIRED = "required"
    PREFERRED = "preferred"
    NICE_TO_HAVE = "nice_to_have"


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    auth_provider: Mapped[str] = mapped_column(
        Enum(AuthProvider), default=AuthProvider.EMAIL, nullable=False
    )
    google_subject_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[str] = mapped_column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    email_tokens: Mapped[list["EmailVerificationToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    security_events: Mapped[list["SecurityEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    job_descriptions: Mapped[list["JobDescription"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_email", "email"),
    )


# ── Auth tokens ───────────────────────────────────────────────────────────────

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # hashed OTP
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="email_tokens")

    __table_args__ = (
        Index("ix_email_verification_user_id", "user_id"),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")


# ── Sessions ──────────────────────────────────────────────────────────────────

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64))  # HMAC hash, not raw IP
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="sessions")

    __table_args__ = (
        Index("ix_sessions_user_id", "user_id"),
        Index("ix_sessions_refresh_token_hash", "refresh_token_hash"),
    )


# ── Security events ───────────────────────────────────────────────────────────

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(Enum(SecurityEventSeverity), default=SecurityEventSeverity.LOW)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    event_metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["User"]] = relationship(back_populates="security_events")

    __table_args__ = (
        Index("ix_security_events_user_id", "user_id"),
        Index("ix_security_events_event_type", "event_type"),
        Index("ix_security_events_created_at", "created_at"),
    )


# ── Resumes ───────────────────────────────────────────────────────────────────

class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)  # original user filename (display only)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)  # random safe key
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 of file bytes
    parsed_text: Mapped[Optional[str]] = mapped_column(Text)
    parsed_metadata: Mapped[Optional[dict]] = mapped_column(JSON)  # extracted name, email, skills, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="resumes")
    resume_skills: Mapped[list["ResumeSkill"]] = relationship(back_populates="resume", cascade="all, delete-orphan")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="resume")

    __table_args__ = (
        Index("ix_resumes_user_id", "user_id"),
    )


# ── Job Descriptions ──────────────────────────────────────────────────────────

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="job_descriptions")
    jd_skills: Mapped[list["JDSkill"]] = relationship(back_populates="job_description", cascade="all, delete-orphan")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="job_description")

    __table_args__ = (
        Index("ix_jd_user_id", "user_id"),
    )


# ── Skills ────────────────────────────────────────────────────────────────────

class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    category: Mapped[Optional[str]] = mapped_column(String(64))

    resume_skills: Mapped[list["ResumeSkill"]] = relationship(back_populates="skill")
    jd_skills: Mapped[list["JDSkill"]] = relationship(back_populates="skill")
    analysis_skills: Mapped[list["AnalysisSkill"]] = relationship(back_populates="skill")

    __table_args__ = (
        Index("ix_skills_name", "name"),
    )


class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    resume_id: Mapped[str] = mapped_column(String(36), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    resume: Mapped["Resume"] = relationship(back_populates="resume_skills")
    skill: Mapped["Skill"] = relationship(back_populates="resume_skills")


class JDSkill(Base):
    __tablename__ = "jd_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    job_description_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    importance: Mapped[str] = mapped_column(Enum(SkillImportance), default=SkillImportance.REQUIRED)
    evidence: Mapped[Optional[str]] = mapped_column(Text)

    job_description: Mapped["JobDescription"] = relationship(back_populates="jd_skills")
    skill: Mapped["Skill"] = relationship(back_populates="jd_skills")


# ── Analyses ──────────────────────────────────────────────────────────────────

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resume_id: Mapped[str] = mapped_column(String(36), ForeignKey("resumes.id", ondelete="RESTRICT"), nullable=False)
    job_description_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(Enum(AnalysisStatus), default=AnalysisStatus.QUEUED, nullable=False)
    overall_score: Mapped[Optional[float]] = mapped_column(Float)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="analyses")
    resume: Mapped["Resume"] = relationship(back_populates="analyses")
    job_description: Mapped["JobDescription"] = relationship(back_populates="analyses")
    analysis_skills: Mapped[list["AnalysisSkill"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    results: Mapped[list["AnalysisResult"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    roadmap_items: Mapped[list["RoadmapItem"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    project_recommendations: Mapped[list["ProjectRecommendation"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_analyses_user_id", "user_id"),
        Index("ix_analyses_status", "status"),
        Index("ix_analyses_created_at", "created_at"),
    )


class AnalysisSkill(Base):
    __tablename__ = "analysis_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    match_status: Mapped[str] = mapped_column(Enum(SkillMatchStatus), nullable=False)
    similarity_score: Mapped[Optional[float]] = mapped_column(Float)
    evidence: Mapped[Optional[str]] = mapped_column(Text)

    analysis: Mapped["Analysis"] = relationship(back_populates="analysis_skills")
    skill: Mapped["Skill"] = relationship(back_populates="analysis_skills")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    section: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "ats", "skill_gap", "projects"
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    analysis: Mapped["Analysis"] = relationship(back_populates="results")

    __table_args__ = (
        UniqueConstraint("analysis_id", "section", name="uq_analysis_section"),
    )


# ── Interviews ────────────────────────────────────────────────────────────────

class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(Enum(InterviewType), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[Optional[str]] = mapped_column(Text)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    difficulty: Mapped[Optional[str]] = mapped_column(String(16))
    topic: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped["Analysis"] = relationship(back_populates="interviews")

    __table_args__ = (
        Index("ix_interviews_analysis_id", "analysis_id"),
    )


# ── Roadmap ───────────────────────────────────────────────────────────────────

class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    week: Mapped[int] = mapped_column(Integer, nullable=False)
    skill: Mapped[str] = mapped_column(String(128), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[Optional[str]] = mapped_column(Text)
    practice_task: Mapped[Optional[str]] = mapped_column(Text)
    project_task: Mapped[Optional[str]] = mapped_column(Text)

    analysis: Mapped["Analysis"] = relationship(back_populates="roadmap_items")


# ── Project recommendations ───────────────────────────────────────────────────

class ProjectRecommendation(Base):
    __tablename__ = "project_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    skills: Mapped[Optional[list]] = mapped_column(JSON)
    technology: Mapped[Optional[list]] = mapped_column(JSON)
    difficulty: Mapped[Optional[str]] = mapped_column(String(32))
    learning_outcome: Mapped[Optional[str]] = mapped_column(Text)
    resume_bullet: Mapped[Optional[str]] = mapped_column(Text)

    analysis: Mapped["Analysis"] = relationship(back_populates="project_recommendations")
