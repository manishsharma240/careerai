# CareerAI — Software Requirements Specification (SRS)

**Version:** 1.0  
**Date:** 2024  
**Project:** CareerAI — AI Career & Interview Agent  
**Classification:** Academic / Portfolio Project

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional, non-functional, security, and AI engineering requirements for CareerAI — a full-stack production-style web application that uses artificial intelligence to analyze a candidate's resume against a job description and generate a comprehensive career preparation package.

### 1.2 Scope
CareerAI covers:
- User authentication (email/password + Google OAuth)
- Secure PDF resume upload and parsing
- Job description ingestion and parsing
- AI-driven analysis pipeline (10 steps)
- ATS-style scoring, skill gap detection, interview generation, roadmap generation
- Authenticated dashboard, history management, session management
- Role-based admin panel

### 1.3 Definitions
| Term | Meaning |
|---|---|
| ATS | Applicant Tracking System — software employers use to filter resumes |
| JD | Job Description |
| OTP | One-Time Password (6-digit email verification code) |
| JWT | JSON Web Token |
| RAG | Retrieval-Augmented Generation |
| LLM | Large Language Model |
| IDOR | Insecure Direct Object Reference |
| pgvector | PostgreSQL extension for vector similarity search |

---

## 2. Overall Description

### 2.1 Product Perspective
CareerAI is a standalone SaaS application with a React frontend and FastAPI backend. It integrates with third-party services (OpenAI/Anthropic for AI, SMTP/Resend for email, Google for OAuth) through the backend only — no third-party API keys are exposed to the frontend.

### 2.2 User Classes
| Class | Description |
|---|---|
| Anonymous Visitor | Can view landing page, FAQ, legal pages |
| Registered User | Can upload resumes, create analyses, manage profile |
| Admin | Can view all users, analyses, security events, AI usage |

### 2.3 Operating Environment
- Frontend: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Mobile: iOS Safari, Android Chrome
- Backend: Python 3.11+, Linux/macOS/Windows
- Database: PostgreSQL 15+
- Cache: Redis 7+

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | User can register with email + password + optional full name | High |
| AUTH-02 | Password must be ≥8 chars, contain uppercase, lowercase, digit | High |
| AUTH-03 | After signup, system sends a 6-digit OTP to the email | High |
| AUTH-04 | OTP is cryptographically random, SHA-256 hashed in storage | High |
| AUTH-05 | OTP expires in 10 minutes | High |
| AUTH-06 | OTP is single-use; used_at is set on successful verification | High |
| AUTH-07 | Maximum 5 verification attempts before lockout | High |
| AUTH-08 | OTP resend cooldown of 60 seconds | Medium |
| AUTH-09 | Login requires verified email | High |
| AUTH-10 | Login issues short-lived JWT access token (15 min) + refresh token (30 days) | High |
| AUTH-11 | Refresh token rotation: old token revoked on each refresh | High |
| AUTH-12 | Google OAuth 2.0 / OIDC login | High |
| AUTH-13 | Google token verified server-side (issuer, audience, signature, expiry) | High |
| AUTH-14 | Password reset via email link (30-min expiry, single-use) | High |
| AUTH-15 | Passwords hashed with Argon2id | High |

### 3.2 Resume Management

| ID | Requirement | Priority |
|---|---|---|
| RES-01 | User can upload PDF resume (drag-drop or click) | High |
| RES-02 | Backend validates: extension, MIME type, PDF magic bytes, file size ≤10 MB | High |
| RES-03 | Storage key is random UUID — original filename never used in storage | High |
| RES-04 | Resume file is stored privately; no public URL exists | High |
| RES-05 | System extracts text from PDF using pypdf | High |
| RES-06 | System calls LLM to extract structured resume data (name, skills, experience, etc.) | High |
| RES-07 | User can list, view metadata, and delete their resumes | Medium |
| RES-08 | Duplicate detection by SHA-256 file hash | Low |

### 3.3 Job Description

| ID | Requirement | Priority |
|---|---|---|
| JD-01 | User can paste a job description (min 100 chars) | High |
| JD-02 | User can set job title and optional company name | High |
| JD-03 | System validates JD content before saving | High |
| JD-04 | User can list, view, and delete their JDs | Medium |

### 3.4 Analysis Pipeline

| ID | Requirement | Priority |
|---|---|---|
| AN-01 | User can start an analysis by selecting a resume + JD | High |
| AN-02 | Analysis runs as a background task; API returns immediately with QUEUED status | High |
| AN-03 | Frontend polls status endpoint every 3 seconds | High |
| AN-04 | Deduplication: duplicate QUEUED/PROCESSING analysis for same resume+JD is returned | Medium |
| AN-05 | Analysis transitions: QUEUED → PROCESSING → COMPLETED / FAILED | High |
| AN-06 | Step 1: Resume text extraction | High |
| AN-07 | Step 2: Structured resume parsing (LLM + Pydantic validation) | High |
| AN-08 | Step 3: JD structured parsing (LLM + Pydantic validation) | High |
| AN-09 | Step 4: Embedding generation for semantic similarity | High |
| AN-10 | Step 5: Skill gap detection (rule-based + semantic) | High |
| AN-11 | Step 6: ATS-style score computation (skill 45% + keyword 30% + semantic 25%) | High |
| AN-12 | Step 7: Project recommendations (LLM, 4 projects) | High |
| AN-13 | Step 8: Technical interview questions (LLM, 8 questions) | High |
| AN-14 | Step 9: HR interview questions (LLM, 6 questions) | High |
| AN-15 | Step 10: Learning roadmap (LLM, 8 weeks) | High |
| AN-16 | Step 11: Resume improvement suggestions (LLM, max 10) | High |
| AN-17 | All LLM outputs validated by Pydantic; malformed → section marked failed | High |

### 3.5 Result Display

| ID | Requirement | Priority |
|---|---|---|
| RD-01 | Dashboard shows overview with score gauges | High |
| RD-02 | ATS tab shows score breakdown with disclaimer about methodology | High |
| RD-03 | Skills tab shows matched / partial / missing with evidence | High |
| RD-04 | Skill Gap table shows all JD requirements with resume evidence | High |
| RD-05 | Projects tab shows 4 recommended projects labelled "Recommended Project" | High |
| RD-06 | Technical Interview tab shows questions with answers + difficulty | High |
| RD-07 | HR Interview tab shows behavioral questions with suggested structure | High |
| RD-08 | Roadmap tab shows week-by-week plan with practice and project tasks | High |
| RD-09 | Resume Suggestions tab shows improvements labelled "Suggested Improvement" | High |

### 3.6 Security & Sessions

| ID | Requirement | Priority |
|---|---|---|
| SEC-01 | User can view all active sessions (user-agent, last seen) | Medium |
| SEC-02 | User can revoke individual sessions | Medium |
| SEC-03 | User can log out all other sessions | Medium |
| SEC-04 | Security events are logged (login, logout, OTP, failed auth) | High |
| SEC-05 | Rate limiting on auth, OTP, upload, analysis, AI endpoints | High |

### 3.7 Admin

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | Admin role checked server-side from DB (never from JWT claim alone) | High |
| ADM-02 | Admin can list users, analyses, security events | Medium |
| ADM-03 | Admin cannot access raw resume file content by default | High |
| ADM-04 | Non-admin requests to admin routes return 404 | High |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- API response (non-AI): < 500 ms P95
- AI pipeline: < 90 seconds end-to-end (background, not blocking)
- Resume upload: < 5 seconds for 10 MB PDF
- Frontend initial load: < 3 seconds on 4G

### 4.2 Security
- No secrets in frontend code
- No raw IPs in database (HMAC-SHA256)
- No plaintext passwords ever (Argon2id)
- No raw OTPs in database (SHA-256)
- CORS restricted to known origins
- Security headers on all responses

### 4.3 Reliability
- Analysis failures are caught and logged; status set to FAILED with error message
- Email delivery failure rolls back the signup transaction
- LLM timeouts are handled gracefully; sections marked as failed individually

### 4.4 Maintainability
- All configuration via environment variables
- Alembic migrations for all schema changes
- Structured JSON logging (structlog)
- Pydantic schemas as single source of truth for I/O contracts

### 4.5 Usability
- Every button is functional (no dead UI)
- Every state has: loading, success, error, empty
- Responsive from 360px mobile to 1440px desktop
- Light and dark mode with single toggle

### 4.6 Accessibility
- Semantic HTML (nav, main, header, button, label)
- Keyboard navigation throughout
- Visible focus indicators
- ARIA labels where needed
- Colour contrast ≥ 4.5:1

---

## 5. Security Requirements

| ID | Requirement |
|---|---|
| SR-01 | Passwords: Argon2id, memory_cost=65536, never logged |
| SR-02 | JWT: HS256, 15-min access, 30-day refresh; refresh stored as SHA-256 hash |
| SR-03 | OTP: 6-digit CSPRNG, SHA-256 hashed, 10-min expiry, 5-attempt limit |
| SR-04 | Files: extension + magic bytes + size validation; random storage keys |
| SR-05 | DB queries: SQLAlchemy ORM only; no string concatenation |
| SR-06 | Ownership: every query includes user_id filter |
| SR-07 | CORS: explicit allowlist; credentials: true with specific origins |
| SR-08 | Headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS (prod) |
| SR-09 | Rate limits: slowapi per-IP; stricter limits on AI and auth endpoints |
| SR-10 | Prompt injection: XML delimiters + "treat as data" system instructions |
| SR-11 | AI output: all LLM responses parsed and validated before rendering |
| SR-12 | Errors: no stack traces, no internal paths, no exception types to users |
| SR-13 | Logging: no passwords, tokens, OTPs, API keys, or full resume text |
| SR-14 | Sessions: refresh token rotation; revocation on logout and password change |

---

## 6. AI Engineering Requirements

| ID | Requirement |
|---|---|
| AI-01 | LLM API keys live only in backend environment variables |
| AI-02 | All user content treated as untrusted data, wrapped in XML delimiters |
| AI-03 | System prompt explicitly instructs model to ignore instructions in data |
| AI-04 | All LLM outputs validated by Pydantic schemas |
| AI-05 | Malformed LLM output → section retry or fail; never rendered raw |
| AI-06 | ATS score clearly labelled as estimate, not employer ATS |
| AI-07 | Project recommendations labelled "Recommended Project", not candidate experience |
| AI-08 | Resume suggestions labelled "Suggested Improvement", not applied changes |
| AI-09 | Evidence clearly separated from AI inference in all outputs |
| AI-10 | Token limits enforced; LLM timeout configured and handled |
| AI-11 | Embeddings reused across pipeline steps where possible |
| AI-12 | AI cost tracked via structured logging (model, estimated tokens, latency) |

---

## 7. Data Requirements

### 7.1 Data Retention
- Users can delete their account; associated data is deleted per policy
- Resumes are soft-deleted (deleted_at timestamp); hard deletion on request
- Security events are retained for audit purposes

### 7.2 Privacy
- Raw IP addresses are never stored; only HMAC-SHA256 hashes
- Resume text is not included in application logs
- Email addresses are normalized (lowercase, trimmed) before storage

---

## 8. Interface Requirements

### 8.1 REST API
- JSON request and response bodies
- JWT Bearer token authentication
- Standard HTTP status codes (200, 201, 202, 204, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 502)

### 8.2 Frontend API Client
- All API calls through a centralized service layer
- No direct LLM calls from browser
- Error states shown to user without exposing technical detail

---

## 9. Constraints

- Frontend must work without a backend connection for the landing page
- AI analysis requires a valid LLM API key configured in `.env`
- Email verification requires a configured email provider
- Google OAuth requires Google Cloud credentials
- File storage defaults to local filesystem; S3-compatible storage for production

---

## 10. Acceptance Criteria

The system is accepted when a new user can complete this full journey without errors:

1. Visit landing page → Create account → Receive OTP email → Verify email
2. Log in → Access dashboard
3. Upload a real PDF resume → See parsed skills
4. Create a job description
5. Start an analysis → See QUEUED → PROCESSING → COMPLETED
6. View ATS score (with methodology disclaimer)
7. View skill gap table with evidence
8. View 4 project recommendations (labelled as recommendations)
9. View 8 technical + 6 HR interview questions
10. View 8-week learning roadmap
11. View resume suggestions (labelled as suggestions)
12. View and revoke active sessions
13. Log out
14. Confirm all private data is inaccessible without authentication
