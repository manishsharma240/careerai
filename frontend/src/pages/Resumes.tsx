import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Trash2, Upload, FileText } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, SkeletonCard, ConfirmDialog } from '../components/StateComponents';
import { useToast } from '../components/Toast';
import { resumeApi, ApiError } from '../api/client';

interface Resume { id: string; filename: string; file_size: number; created_at: string; }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Resumes() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setResumes(await resumeApi.list()); }
    catch (e) { setError(e instanceof ApiError ? e.detail : 'Failed to load resumes.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const _n = file.name.toLowerCase();
    if (!_n.endsWith('.pdf') && !_n.endsWith('.docx')) { toast.error('Only PDF or DOCX files are accepted.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File exceeds the 10 MB limit.'); return; }
    setUploading(true);
    try {
      const res = await resumeApi.upload(file);
      setResumes(prev => [res, ...prev]);
      toast.success('Resume uploaded successfully.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await resumeApi.delete(deleteId);
      setResumes(prev => prev.filter(r => r.id !== deleteId));
      toast.success('Resume deleted.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Could not delete resume.');
    } finally { setDeleting(false); setDeleteId(null); }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Resumes" subtitle="Your uploaded resume files" />

        <main className="flex-1 p-6 max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-ink-muted">{resumes.length} resume{resumes.length !== 1 ? 's' : ''} uploaded</p>
            <div>
              <label
                htmlFor="resume-page-upload-input"
                className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all cursor-pointer
                  bg-accent text-white hover:opacity-90 px-3 py-1.5 text-xs
                  ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <Upload size={14} />
                )}
                Upload resume
              </label>
              <input
                ref={fileRef}
                id="resume-page-upload-input"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={handleUpload}
              />
            </div>
          </div>

          {loading && <div className="flex flex-col gap-4">{[1,2].map(i => <SkeletonCard key={i} />)}</div>}
          {error && <ErrorState message={error} onRetry={load} />}

          {!loading && !error && resumes.length === 0 && (
            <EmptyState
              icon="📄"
              title="No resumes uploaded"
              description="Upload your first resume (PDF or DOCX) to start analyzing against job descriptions."
              action={{ label: 'Upload resume', onClick: () => document.getElementById('resume-page-upload-input')?.click() }}
            />
          )}

          {!loading && !error && resumes.length > 0 && (
            <div className="flex flex-col gap-4">
              {resumes.map(r => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                      <FileText size={22} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{r.filename}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {formatBytes(r.file_size)} · Uploaded {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteId(r.id)}
                      aria-label={`Delete ${r.filename}`}
                      className="p-2 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/5 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <p className="mt-6 text-xs text-ink-muted">
            Resume files are stored privately. Only you can access your own resumes.
            Files are validated for PDF/DOCX format and size before storage.
          </p>
        </main>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete resume?"
        description="This will permanently delete this resume file. Any analyses using it will not be affected."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        dangerous
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
