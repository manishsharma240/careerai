import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, CheckCircle } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { resumeApi, jdApi, analysisApi, ApiError } from '../api/client';

type Step = 'upload' | 'jd' | 'analyze';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewAnalysis() {
  const navigate = useNavigate();
  const toast = useToast();

  // Resume state
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // JD state
  const [jdTitle, setJdTitle] = useState('');
  const [jdCompany, setJdCompany] = useState('');
  const [jdContent, setJdContent] = useState('');
  const [jdError, setJdError] = useState('');
  const [jdId, setJdId] = useState<string | null>(null);
  const [savingJd, setSavingJd] = useState(false);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);

  const step: Step = !resumeId ? 'upload' : !jdId ? 'jd' : 'analyze';

  // ── Resume upload ─────────────────────────────────────────────────────────
  async function uploadFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setUploadError('Only PDF or DOCX files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds the 10 MB limit.');
      return;
    }
    setUploadError('');
    setUploadLoading(true);
    try {
      const res = await resumeApi.upload(file);
      setResumeId(res.id);
      setResumeFile({ name: res.filename, size: res.file_size });
      toast.success('Resume uploaded successfully.');
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.detail : 'Upload failed. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function removeResume() {
    setResumeId(null);
    setResumeFile(null);
    setUploadError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── JD save ───────────────────────────────────────────────────────────────
  async function saveJd() {
    if (!jdTitle.trim()) { setJdError('Job title is required.'); return; }
    if (jdContent.trim().length < 100) { setJdError('Job description must be at least 100 characters.'); return; }
    setJdError('');
    setSavingJd(true);
    try {
      const res = await jdApi.create(jdTitle.trim(), jdContent.trim(), jdCompany.trim() || undefined);
      setJdId(res.id);
      toast.success('Job description saved.');
    } catch (err) {
      setJdError(err instanceof ApiError ? err.detail : 'Failed to save job description.');
    } finally {
      setSavingJd(false);
    }
  }

  // ── Start analysis ────────────────────────────────────────────────────────
  async function startAnalysis() {
    if (!resumeId || !jdId) return;
    setAnalyzing(true);
    try {
      const res = await analysisApi.create(resumeId, jdId);
      navigate(`/analyses/${res.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : 'Could not start analysis. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps = [
    { id: 'upload', label: 'Upload Resume', done: !!resumeId },
    { id: 'jd', label: 'Job Description', done: !!jdId },
    { id: 'analyze', label: 'Start Analysis', done: false },
  ];

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="New Analysis" subtitle="Upload your resume and paste the job description" />

        <main className="flex-1 p-6 max-w-2xl">
          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold
                  ${s.done ? 'bg-success text-white' : s.id === step ? 'bg-accent text-white' : 'bg-border text-ink-muted'}`}>
                  {s.done ? '✓' : i + 1}
                </div>
                <span className={`text-sm font-medium ${s.id === step ? 'text-ink' : 'text-ink-muted'}`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {/* Step 1: Resume upload */}
          <Card className="p-6 mb-5">
            <h2 className="font-display font-semibold text-ink mb-1">
              {resumeId ? '✓ Resume uploaded' : 'Upload your resume'}
            </h2>
            <p className="text-sm text-ink-muted mb-5">PDF or DOCX · max 10 MB</p>

            {!resumeId ? (
              <>
                <label
                  htmlFor="resume-upload-input"
                  tabIndex={0}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                  aria-label="Upload PDF resume"
                  className={`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                    ${dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent hover:bg-accent-soft/30'}
                    ${uploadLoading ? 'pointer-events-none opacity-60' : ''}`}
                >
                  {uploadLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <p className="text-sm text-ink-muted">Uploading and parsing…</p>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-ink-muted mb-3" />
                      <p className="font-medium text-ink">Drop your resume here</p>
                      <p className="text-sm text-ink-muted mt-1">or click to browse</p>
                    </>
                  )}
                </label>
                <input
                  ref={fileRef}
                  id="resume-upload-input"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {uploadError && (
                  <p role="alert" className="mt-3 text-sm text-danger">{uploadError}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
                <CheckCircle size={20} className="text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{resumeFile?.name}</p>
                  <p className="text-xs text-ink-muted">{formatBytes(resumeFile?.size || 0)}</p>
                </div>
                <button onClick={removeResume} aria-label="Remove resume" className="text-ink-muted hover:text-danger transition-colors">
                  <X size={17} />
                </button>
              </div>
            )}
          </Card>

          {/* Step 2: Job description */}
          <Card className="p-6 mb-5">
            <h2 className="font-display font-semibold text-ink mb-1">
              {jdId ? '✓ Job description saved' : 'Paste the job description'}
            </h2>
            <p className="text-sm text-ink-muted mb-5">Minimum 100 characters · max 50,000 characters</p>

            {!jdId ? (
              <div className="flex flex-col gap-4">
                <Input
                  label="Job title"
                  value={jdTitle}
                  onChange={e => { setJdTitle(e.target.value); setJdError(''); }}
                  placeholder="e.g. Senior Backend Engineer"
                  required
                />
                <Input
                  label="Company (optional)"
                  value={jdCompany}
                  onChange={e => setJdCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="jd-content" className="text-sm font-medium text-ink">
                    Job description
                  </label>
                  <textarea
                    id="jd-content"
                    rows={10}
                    value={jdContent}
                    onChange={e => { setJdContent(e.target.value); setJdError(''); }}
                    placeholder="Paste the full job description here…"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink
                      placeholder:text-ink-muted resize-y focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="text-xs text-ink-muted text-right">{jdContent.length.toLocaleString()} characters</p>
                </div>
                {jdError && <p role="alert" className="text-sm text-danger">{jdError}</p>}
                <Button onClick={saveJd} loading={savingJd} disabled={!resumeId}>
                  Save Job Description
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
                <CheckCircle size={20} className="text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{jdTitle}</p>
                  {jdCompany && <p className="text-xs text-ink-muted">{jdCompany}</p>}
                </div>
                <button onClick={() => setJdId(null)} aria-label="Edit job description" className="text-xs text-accent hover:underline">
                  Edit
                </button>
              </div>
            )}
          </Card>

          {/* Step 3: Start analysis */}
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink mb-1">Start AI analysis</h2>
            <p className="text-sm text-ink-muted mb-5">
              CareerAI will run a 10-step pipeline to generate your ATS score, skill gap analysis,
              interview questions, learning roadmap and resume suggestions.
            </p>
            <Button
              className="w-full"
              size="lg"
              disabled={!resumeId || !jdId}
              loading={analyzing}
              onClick={startAnalysis}
            >
              {analyzing ? 'Starting analysis…' : '🚀 Analyze Resume & Job'}
            </Button>
            {(!resumeId || !jdId) && (
              <p className="text-xs text-ink-muted text-center mt-3">
                Complete the steps above to start.
              </p>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
