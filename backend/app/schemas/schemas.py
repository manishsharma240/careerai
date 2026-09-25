"""
CareerAI Pydantic schemas — request/response contracts for every endpoint.
Input is validated before touching the database or AI pipeline.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


# ── Helpers ───────────────────────────────────────────────────────────────────

PASSWORD_MIN = 8
PASSWORD_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
)


def validate_password_strength(v: str) -> str:
    if not PASSWORD_RE.match(v):
        raise ValueError(
            "Password must be at least 8 characters and contain an uppercase letter, "
            "a lowercase letter, and a digit."
        )
    return v


# ── Auth ──────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN, max_length=128)
    confirm_password: str
    full_name: Optional[str] = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info: Any) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendOTPRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=PASSWORD_MIN, max_length=128)
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info: Any) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # seconds


class MessageResponse(BaseModel):
    message: str


# ── User ──────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    email_verified: bool
    role: str
    auth_provider: str
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: str
    user_agent: Optional[str]
    created_at: datetime
    last_seen_at: datetime
    is_current: bool

    model_config = {"from_attributes": True}


# ── Resume ────────────────────────────────────────────────────────────────────

class ResumeResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    created_at: datetime
    metadata: Optional[dict]

    model_config = {"from_attributes": True}


# ── Job Description ───────────────────────────────────────────────────────────

class CreateJDRequest(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    company: Optional[str] = Field(default=None, max_length=255)
    content: str = Field(min_length=100, max_length=50_000)


class JDResponse(BaseModel):
    id: str
    title: str
    company: Optional[str]
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analysis ──────────────────────────────────────────────────────────────────

class CreateAnalysisRequest(BaseModel):
    resume_id: str
    job_description_id: str


class AnalysisStatusResponse(BaseModel):
    id: str
    status: str
    overall_score: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]
    job_title: Optional[str] = None
    company: Optional[str] = None

    model_config = {"from_attributes": True}


class SkillGapItem(BaseModel):
    skill: str
    category: Optional[str]
    required: bool
    resume_evidence: Optional[str]
    match_status: str
    importance: str
    suggested_action: Optional[str]
    similarity_score: Optional[float]


class ATSResult(BaseModel):
    overall_score: float
    keyword_score: float
    skill_score: float
    semantic_score: float
    matched_keywords: list[str]
    missing_keywords: list[str]
    formatting_suggestions: list[str]
    improvement_suggestions: list[str]
    disclaimer: str = (
        "This is a CareerAI estimated match score based on keyword alignment, "
        "skills and semantic similarity. It does not represent any employer's "
        "actual ATS system or score."
    )


class ProjectRecommendationItem(BaseModel):
    title: str
    reason: str
    skills: list[str]
    technology: list[str]
    difficulty: str
    learning_outcome: str
    resume_bullet: str
    label: str = "Recommended Project"


class InterviewQuestion(BaseModel):
    question: str
    topic: str
    difficulty: str
    expected_answer: str
    explanation: str
    follow_up_questions: list[str]
    type: str  # technical | hr


class RoadmapWeek(BaseModel):
    week: int
    skill: str
    topic: str
    objective: str
    practice_task: str
    project_task: str


class ResumeSuggestion(BaseModel):
    category: str  # keyword | bullet | formatting | skill | project | alignment
    original: Optional[str]
    suggestion: str
    reason: str
    label: str = "Suggested Improvement"


class FullAnalysisResponse(BaseModel):
    id: str
    status: str
    overall_score: Optional[float]
    ats: Optional[ATSResult]
    skill_gaps: list[SkillGapItem]
    projects: list[ProjectRecommendationItem]
    technical_interview: list[InterviewQuestion]
    hr_interview: list[InterviewQuestion]
    roadmap: list[RoadmapWeek]
    resume_suggestions: list[ResumeSuggestion]
    created_at: datetime
    completed_at: Optional[datetime]


# ── AI generation requests ────────────────────────────────────────────────────

class RegenerateRequest(BaseModel):
    section: str = Field(pattern=r"^(interview|roadmap|projects|resume_suggestions)$")


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    email_verified: bool
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int
