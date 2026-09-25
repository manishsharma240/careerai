/**
 * CareerAI API client.
 * - All requests go through this module — never call LLM APIs from here.
 * - Access token stored in memory (not localStorage) for XSS safety.
 * - Refresh token stored in localStorage (no sensitive AI/DB access from it).
 * - On 401, auto-refreshes once then redirects to /login.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── PREVIEW / MOCK MODE ─────────────────────────────────────────────────────
// Active only when built with VITE_MOCK=true. Simulates the backend with
// realistic fake data and network delays so the UI can be clicked through
// without a real database, email provider, or LLM key. Has zero effect on
// the real production build.
const MOCK = import.meta.env.VITE_MOCK === 'true';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
let mockOtpSent = '';
let mockResumeCounter = 0;
let mockJdCounter = 0;
let mockAnalysisStore: Record<string, { status: string; startedAt: number }> = {};

const MOCK_RESUME_META: Record<string, unknown> = {
  name: 'Aditi Sharma', email: 'aditi.sharma@example.com',
  skills: {
    programming_languages: ['Python', 'TypeScript', 'SQL'],
    frameworks: ['FastAPI', 'React'],
    databases: ['PostgreSQL', 'Redis'],
    cloud: ['AWS'],
    ai_ml: ['Embeddings', 'LLM APIs'],
  },
};

const MOCK_ANALYSIS_RESULT: FullAnalysisResult = {
  id: 'mock-analysis-1',
  status: 'completed',
  overall_score: 78,
  ats: {
    overall_score: 78, keyword_score: 71, skill_score: 85, semantic_score: 74,
    matched_keywords: ['Python', 'FastAPI', 'PostgreSQL', 'REST API', 'Docker'],
    missing_keywords: ['Kubernetes', 'GraphQL', 'Terraform'],
    formatting_suggestions: [
      'Use standard section headings (Experience, Education, Skills).',
      'Avoid tables and text boxes — many ATS systems cannot parse them.',
    ],
    improvement_suggestions: [
      'Add missing required skills: Kubernetes, GraphQL, Terraform.',
      'Include these keywords: Kubernetes, Terraform.',
    ],
    disclaimer: 'This is a CareerAI estimated match score based on keyword alignment, skills and semantic similarity. It does not represent any employer\'s actual ATS system or score.',
  },
  skill_gaps: [
    { skill: 'Python', category: 'required', required: true, resume_evidence: 'Python, pandas, FastAPI listed in Skills section', match_status: 'matched', importance: 'required', suggested_action: undefined, similarity_score: 0.95 },
    { skill: 'FastAPI', category: 'required', required: true, resume_evidence: 'Built 3 production APIs with FastAPI', match_status: 'matched', importance: 'required', suggested_action: undefined, similarity_score: 0.92 },
    { skill: 'PostgreSQL', category: 'required', required: true, resume_evidence: 'PostgreSQL, Redis listed in Skills section', match_status: 'matched', importance: 'required', suggested_action: undefined, similarity_score: 0.9 },
    { skill: 'Docker', category: 'preferred', required: false, resume_evidence: 'Mentioned in project descriptions', match_status: 'partial', importance: 'preferred', suggested_action: "Add 'Docker' explicitly to your skills section.", similarity_score: 0.6 },
    { skill: 'Kubernetes', category: 'required', required: true, resume_evidence: 'Not found in resume.', match_status: 'missing', importance: 'required', suggested_action: 'Learn Kubernetes and add a project or certification to demonstrate it.', similarity_score: 0.1 },
    { skill: 'GraphQL', category: 'preferred', required: false, resume_evidence: 'Not found in resume.', match_status: 'missing', importance: 'preferred', suggested_action: 'Learn GraphQL and add a project or certification to demonstrate it.', similarity_score: 0.05 },
    { skill: 'Terraform', category: 'nice_to_have', required: false, resume_evidence: 'Not found in resume.', match_status: 'missing', importance: 'nice_to_have', suggested_action: 'Learn Terraform and add a project or certification to demonstrate it.', similarity_score: 0.02 },
  ],
  projects: [
    {
      title: 'Kubernetes-Deployed Microservice API', label: 'Recommended Project',
      reason: 'Directly demonstrates the Kubernetes skill missing from your resume, while reinforcing your existing FastAPI and PostgreSQL experience.',
      skills: ['Kubernetes', 'Container Orchestration', 'FastAPI', 'PostgreSQL'],
      technology: ['Python', 'FastAPI', 'Docker', 'Kubernetes', 'Helm'],
      difficulty: 'Intermediate',
      learning_outcome: 'You will understand pod scheduling, service discovery, and rolling deployments in a real orchestrated environment.',
      resume_bullet: 'Deployed a FastAPI microservice to a 3-node Kubernetes cluster with Helm charts, reducing deployment time by 40%.',
    },
    {
      title: 'GraphQL Gateway for Existing REST APIs', label: 'Recommended Project',
      reason: 'Closes the GraphQL gap by wrapping your existing REST API knowledge in a GraphQL layer, a common enterprise pattern.',
      skills: ['GraphQL', 'API Design', 'Schema Design'],
      technology: ['Python', 'Strawberry GraphQL', 'FastAPI'],
      difficulty: 'Intermediate',
      learning_outcome: 'You will learn schema-first API design and how GraphQL resolvers map to underlying data sources.',
      resume_bullet: 'Built a GraphQL gateway unifying 4 REST microservices, cutting frontend over-fetching by 35%.',
    },
    {
      title: 'Infrastructure-as-Code Pipeline with Terraform', label: 'Recommended Project',
      reason: 'Addresses the Terraform gap while giving you hands-on cloud provisioning experience relevant to the AWS skill you already have.',
      skills: ['Terraform', 'Infrastructure as Code', 'AWS'],
      technology: ['Terraform', 'AWS', 'GitHub Actions'],
      difficulty: 'Beginner',
      learning_outcome: 'You will learn declarative infrastructure provisioning and how to version infrastructure changes safely.',
      resume_bullet: 'Automated AWS infrastructure provisioning with Terraform, reducing environment setup time from 2 days to 20 minutes.',
    },
    {
      title: 'Real-Time Analytics Dashboard', label: 'Recommended Project',
      reason: 'Combines your existing PostgreSQL and React skills with a new real-time data pattern relevant to backend-heavy roles.',
      skills: ['WebSockets', 'Data Visualization', 'PostgreSQL'],
      technology: ['FastAPI', 'WebSockets', 'React', 'Recharts'],
      difficulty: 'Advanced',
      learning_outcome: 'You will learn real-time data streaming patterns and how to keep a frontend UI in sync with backend state changes.',
      resume_bullet: 'Built a real-time analytics dashboard streaming live metrics via WebSockets to 200+ concurrent users.',
    },
  ],
  technical_interview: [
    { question: 'Walk me through how FastAPI handles dependency injection, and why you chose it for your resume-parsing pipeline.', topic: 'FastAPI', difficulty: 'Medium', expected_answer: 'FastAPI uses Depends() to declare reusable dependencies resolved per-request. In a resume pipeline, this is used for get_current_user, get_db session, and get_verified_user checks, keeping route handlers thin and testable.', explanation: 'Tests understanding of the framework the candidate actually used, not generic trivia.', follow_up_questions: ['How would you test a route with Depends() mocked out?', 'What happens if two dependencies both need the DB session?'], type: 'technical' },
    { question: 'Your resume mentions PostgreSQL — explain how you would design indexes for a table with 10 million analysis rows queried by user_id and status.', topic: 'SQL', difficulty: 'Medium', expected_answer: 'A composite index on (user_id, status) since queries filter by both. Consider a partial index if status=COMPLETED is queried far more often than others.', explanation: 'Connects a resume-listed skill to a realistic scaling scenario.', follow_up_questions: ['When would a partial index hurt instead of help?'], type: 'technical' },
    { question: 'How would you prevent a malicious PDF upload from being executed on the server?', topic: 'Security', difficulty: 'Hard', expected_answer: 'Validate file extension, MIME type, and magic bytes independently; never trust the client; store with a random filename outside any executable path; never execute uploaded files.', explanation: 'Directly tests the file security pattern used in this project.', follow_up_questions: ['What if the magic bytes are spoofed but the payload is still malicious?'], type: 'technical' },
    { question: 'Explain the trade-off between storing a JWT in localStorage vs. an httpOnly cookie.', topic: 'Security', difficulty: 'Medium', expected_answer: 'localStorage is readable by JS, so vulnerable to XSS exfiltration. httpOnly cookies are not readable by JS but are vulnerable to CSRF, requiring separate CSRF protection.', explanation: 'Standard but important auth architecture question.', follow_up_questions: ['How does SameSite=Strict change this trade-off?'], type: 'technical' },
  ],
  hr_interview: [
    { question: 'Tell me about a time you had to learn a new technology quickly for a project.', topic: 'Behavioral', difficulty: 'Easy', expected_answer: 'Structure with Situation, Task, Action, Result. Reference a specific skill gap you closed and how you measured success.', explanation: 'Standard STAR-format behavioral question.', follow_up_questions: [], type: 'hr' },
    { question: 'This role requires collaborating closely with backend and frontend teams — how do you approach cross-team communication?', topic: 'Collaboration', difficulty: 'Easy', expected_answer: 'Give a concrete example of aligning API contracts early with a frontend team to avoid rework.', explanation: 'Tests role-fit given the full-stack nature of your resume.', follow_up_questions: [], type: 'hr' },
    { question: 'Where do you see yourself in the next 2-3 years?', topic: 'Career Goals', difficulty: 'Easy', expected_answer: 'Connect your stated skills gap (Kubernetes, GraphQL) to a growth narrative that aligns with this role\'s trajectory.', explanation: 'Standard but should be tailored to your actual resume gaps.', follow_up_questions: [], type: 'hr' },
  ],
  roadmap: [
    { week: 1, skill: 'Kubernetes', topic: 'Container Orchestration Fundamentals', objective: 'Understand pods, deployments, services, and the kubectl CLI.', practice_task: 'Deploy your existing FastAPI app to a local Minikube cluster.', project_task: 'This becomes the foundation of the Kubernetes-Deployed Microservice API project.' },
    { week: 2, skill: 'Kubernetes', topic: 'Helm Charts & Config Management', objective: 'Package your app as a reusable Helm chart.', practice_task: 'Convert your Minikube deployment into a parameterized Helm chart.', project_task: 'Add the Helm chart to your Kubernetes project repo.' },
    { week: 3, skill: 'GraphQL', topic: 'Schema Design Fundamentals', objective: 'Learn GraphQL type systems and resolver patterns.', practice_task: 'Wrap one existing REST endpoint in a GraphQL query using Strawberry.', project_task: 'Start the GraphQL Gateway project with a single unified query.' },
    { week: 4, skill: 'GraphQL', topic: 'Mutations & Error Handling', objective: 'Implement mutations and structured GraphQL error responses.', practice_task: 'Add a mutation that creates a resource through your gateway.', project_task: 'Extend the GraphQL Gateway to cover 2 more REST services.' },
    { week: 5, skill: 'Terraform', topic: 'IaC Fundamentals', objective: 'Understand Terraform state, providers, and resources.', practice_task: 'Provision a single S3 bucket and an EC2 instance via Terraform.', project_task: 'Begin the Infrastructure-as-Code Pipeline project.' },
    { week: 6, skill: 'Terraform', topic: 'Modules & CI Integration', objective: 'Modularize Terraform code and run it through GitHub Actions.', practice_task: 'Wrap your Terraform code in a reusable module with variables.', project_task: 'Wire the Terraform pipeline into a GitHub Actions workflow.' },
    { week: 7, skill: 'Integration', topic: 'Connecting the Projects', objective: 'Deploy the GraphQL gateway to the Kubernetes cluster using the Terraform pipeline.', practice_task: 'Write a deployment script that ties all 3 projects together end-to-end.', project_task: 'Document the full pipeline in a README for your portfolio.' },
    { week: 8, skill: 'Interview Prep', topic: 'Portfolio Presentation', objective: 'Prepare to explain all 3 projects clearly in an interview setting.', practice_task: 'Record yourself giving a 2-minute walkthrough of each project.', project_task: 'Add specific, quantified bullets for each project to your resume.' },
  ],
  resume_suggestions: [
    { category: 'skill', label: 'Suggested Improvement', original: undefined, suggestion: "Add a dedicated 'DevOps & Infrastructure' subsection once you've completed the Kubernetes and Terraform projects.", reason: 'The target role lists Kubernetes as a required skill; grouping infra skills together improves ATS keyword detection.' },
    { category: 'bullet', label: 'Suggested Improvement', original: 'Worked on backend APIs using Python.', suggestion: 'Built and maintained 5 production REST APIs in FastAPI serving 10K+ daily requests, with 99.9% uptime.', reason: 'Quantified, specific bullets score higher on both ATS keyword matching and human review.' },
    { category: 'keyword', label: 'Suggested Improvement', original: undefined, suggestion: "Include the exact phrase 'container orchestration' somewhere in your skills or project descriptions.", reason: 'This exact phrase appears in the job description but not in your resume, even though related concepts do.' },
    { category: 'formatting', label: 'Suggested Improvement', original: undefined, suggestion: 'Move your Skills section above Experience if applying to roles with strict ATS keyword screening.', reason: 'Some ATS parsers weight the first 1/3 of a document more heavily during keyword extraction.' },
  ],
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  completed_at: new Date().toISOString(),
};

// ── Token storage (memory for access, localStorage for refresh) ───────────────
let accessToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  localStorage.setItem('careerai_refresh', refresh);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('careerai_refresh');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('careerai_refresh');
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── API error ─────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

async function attemptRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && _retry) {
    // Try refresh once
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await attemptRefresh();
      isRefreshing = false;
      if (newToken) {
        onRefreshed(newToken);
        return request<T>(path, options, false);
      } else {
        // Session expired — redirect to login
        window.location.href = '/login';
        throw new ApiError(401, 'Session expired. Please log in again.');
      }
    } else {
      // Queue the request until refresh completes
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((token) => {
          headers['Authorization'] = `Bearer ${token}`;
          fetch(`${API_BASE}${path}`, { ...options, headers })
            .then(r => r.json().then(d => resolve(d)))
            .catch(reject);
        });
      });
    }
  }

  if (!res.ok) {
    let detail = 'Something went wrong. Please try again.';
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch { /* non-JSON error response */ }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const authApi = {
  signup: async (email: string, password: string, confirmPassword: string, fullName?: string) => {
    if (MOCK) {
      await delay(700);
      mockOtpSent = '123456'; // fixed code shown in the preview banner
      return { message: 'Verification code sent.' };
    }
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirm_password: confirmPassword, full_name: fullName }),
    });
  },

  verifyEmail: async (email: string, otp: string) => {
    if (MOCK) {
      await delay(600);
      if (otp !== (mockOtpSent || '123456')) throw new ApiError(400, 'Invalid or expired code. (Preview hint: use 123456)');
      return { message: 'Email verified.' };
    }
    return request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resendOtp: async (email: string) => {
    if (MOCK) { await delay(500); return { message: 'A new code has been sent.' }; }
    return request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  login: async (email: string, password: string) => {
    if (MOCK) {
      await delay(700);
      return { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token', expires_in: 900 };
    }
    return request<{ access_token: string; refresh_token: string; expires_in: number }>(
      '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  },

  logout: async () => {
    if (MOCK) { await delay(200); clearTokens(); return { message: 'Logged out.' }; }
    const refresh = getRefreshToken();
    return request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refresh }),
    }).finally(clearTokens);
  },

  forgotPassword: async (email: string) => {
    if (MOCK) { await delay(600); return { message: 'If this email is registered, a reset link has been sent.' }; }
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    if (MOCK) { await delay(600); return { message: 'Password reset successfully.' }; }
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
    });
  },
};

// ── Resume endpoints ──────────────────────────────────────────────────────────
let mockResumes: Array<{ id: string; filename: string; file_size: number; created_at: string }> = [];

export const resumeApi = {
  upload: async (file: File) => {
    if (MOCK) {
      await delay(1200);
      mockResumeCounter += 1;
      const res = { id: `mock-resume-${mockResumeCounter}`, filename: file.name, file_size: file.size, created_at: new Date().toISOString(), metadata: MOCK_RESUME_META };
      mockResumes = [res, ...mockResumes];
      return res;
    }
    const form = new FormData();
    form.append('file', file);
    return request<{ id: string; filename: string; file_size: number; created_at: string }>(
      '/resumes/upload', { method: 'POST', body: form }
    );
  },

  list: async () => {
    if (MOCK) { await delay(400); return mockResumes; }
    return request<Array<{ id: string; filename: string; file_size: number; created_at: string }>>('/resumes');
  },

  get: (id: string) =>
    request<{ id: string; filename: string; file_size: number; created_at: string; metadata: Record<string, unknown> }>(`/resumes/${id}`),

  delete: async (id: string) => {
    if (MOCK) { await delay(300); mockResumes = mockResumes.filter(r => r.id !== id); return; }
    return request(`/resumes/${id}`, { method: 'DELETE' });
  },
};

// ── Job Description endpoints ─────────────────────────────────────────────────
let mockJds: Array<{ id: string; title: string; company?: string; created_at: string }> = [];

export const jdApi = {
  create: async (title: string, content: string, company?: string) => {
    if (MOCK) {
      await delay(500);
      mockJdCounter += 1;
      const res = { id: `mock-jd-${mockJdCounter}`, title, company, created_at: new Date().toISOString() };
      mockJds = [res, ...mockJds];
      return res;
    }
    return request<{ id: string; title: string; company?: string; created_at: string }>(
      '/job-descriptions', {
        method: 'POST',
        body: JSON.stringify({ title, content, company }),
      }
    );
  },

  list: async () => {
    if (MOCK) { await delay(300); return mockJds; }
    return request<Array<{ id: string; title: string; company?: string; created_at: string }>>('/job-descriptions');
  },

  delete: async (id: string) => {
    if (MOCK) { await delay(200); mockJds = mockJds.filter(j => j.id !== id); return; }
    return request(`/job-descriptions/${id}`, { method: 'DELETE' });
  },
};

// ── Analysis endpoints ────────────────────────────────────────────────────────
let mockAnalysesList: Array<{
  id: string; status: string; overall_score: number | null;
  created_at: string; job_title?: string; company?: string;
}> = [];

// Simulated pipeline timing: QUEUED (0-1.5s) → PROCESSING (1.5-7s) → COMPLETED
const MOCK_PIPELINE_MS = 7000;

export const analysisApi = {
  create: async (resumeId: string, jobDescriptionId: string) => {
    if (MOCK) {
      await delay(400);
      const id = `mock-analysis-${Date.now()}`;
      mockAnalysisStore[id] = { status: 'queued', startedAt: Date.now() };
      const jd = mockJds.find(j => j.id === jobDescriptionId);
      mockAnalysesList = [{
        id, status: 'queued', overall_score: null,
        created_at: new Date().toISOString(),
        job_title: jd?.title || 'Backend Engineer',
        company: jd?.company || 'Nimbus Systems',
      }, ...mockAnalysesList];
      return { id, status: 'queued', created_at: new Date().toISOString() };
    }
    return request<{ id: string; status: string; created_at: string }>(
      '/analyses', {
        method: 'POST',
        body: JSON.stringify({ resume_id: resumeId, job_description_id: jobDescriptionId }),
      }
    );
  },

  list: async () => {
    if (MOCK) { await delay(300); return mockAnalysesList; }
    return request<Array<{
      id: string; status: string; overall_score: number | null;
      created_at: string; job_title?: string; company?: string;
    }>>('/analyses');
  },

  getStatus: async (id: string) => {
    if (MOCK) {
      await delay(250);
      const entry = mockAnalysisStore[id];
      if (!entry) return { id, status: 'completed', overall_score: 78, created_at: new Date().toISOString(), completed_at: new Date().toISOString() };
      const elapsed = Date.now() - entry.startedAt;
      let status = 'queued';
      if (elapsed > MOCK_PIPELINE_MS) status = 'completed';
      else if (elapsed > 1200) status = 'processing';
      entry.status = status;
      // reflect in list too
      const row = mockAnalysesList.find(a => a.id === id);
      if (row) { row.status = status; if (status === 'completed') row.overall_score = 78; }
      return {
        id, status, overall_score: status === 'completed' ? 78 : null,
        created_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : undefined,
      };
    }
    return request<{ id: string; status: string; overall_score: number | null; created_at: string; completed_at?: string }>(
      `/analyses/${id}/status`
    );
  },

  getResult: async (id: string) => {
    if (MOCK) { await delay(500); return { ...MOCK_ANALYSIS_RESULT, id }; }
    return request<FullAnalysisResult>(`/analyses/${id}`);
  },

  delete: async (id: string) => {
    if (MOCK) { await delay(300); mockAnalysesList = mockAnalysesList.filter(a => a.id !== id); delete mockAnalysisStore[id]; return; }
    return request(`/analyses/${id}`, { method: 'DELETE' });
  },
};

// ── Shared types ──────────────────────────────────────────────────────────────
export interface SkillGapItem {
  skill: string;
  category?: string;
  required: boolean;
  resume_evidence?: string;
  match_status: 'matched' | 'missing' | 'partial' | 'related';
  importance: string;
  suggested_action?: string;
  similarity_score?: number;
}

export interface InterviewQuestion {
  question: string;
  topic: string;
  difficulty: string;
  expected_answer: string;
  explanation: string;
  follow_up_questions: string[];
  type: string;
}

export interface RoadmapWeek {
  week: number;
  skill: string;
  topic: string;
  objective: string;
  practice_task: string;
  project_task: string;
}

export interface ProjectItem {
  title: string;
  reason: string;
  skills: string[];
  technology: string[];
  difficulty: string;
  learning_outcome: string;
  resume_bullet: string;
  label: string;
}

export interface ResumeSuggestion {
  category: string;
  original?: string;
  suggestion: string;
  reason: string;
  label: string;
}

export interface ATSResult {
  overall_score: number;
  keyword_score: number;
  skill_score: number;
  semantic_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  formatting_suggestions: string[];
  improvement_suggestions: string[];
  disclaimer: string;
}

export interface FullAnalysisResult {
  id: string;
  status: string;
  overall_score: number | null;
  ats?: ATSResult;
  skill_gaps: SkillGapItem[];
  projects: ProjectItem[];
  technical_interview: InterviewQuestion[];
  hr_interview: InterviewQuestion[];
  roadmap: RoadmapWeek[];
  resume_suggestions: ResumeSuggestion[];
  created_at: string;
  completed_at?: string;
}
