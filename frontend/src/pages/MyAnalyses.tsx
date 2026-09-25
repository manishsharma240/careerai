import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink, Search } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { EmptyState, ErrorState, SkeletonTable, ConfirmDialog } from '../components/StateComponents';
import { SkillBadge } from '../components/StateComponents';
import { analysisApi, ApiError } from '../api/client';
import { useToast } from '../components/Toast';

interface AnalysisSummary {
  id: string; status: string; overall_score: number | null;
  created_at: string; job_title?: string; company?: string;
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    completed: 'matched', failed: 'missing',
    processing: 'partial', queued: 'related',
  };
  return map[status] || 'related';
}

export default function MyAnalyses() {
  const navigate = useNavigate();
  const toast = useToast();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setAnalyses(await analysisApi.list()); }
    catch (e) { setError(e instanceof ApiError ? e.detail : 'Failed to load analyses.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await analysisApi.delete(deleteId);
      setAnalyses(prev => prev.filter(a => a.id !== deleteId));
      toast.success('Analysis deleted.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Could not delete analysis.');
    } finally { setDeleting(false); setDeleteId(null); }
  }

  const filtered = analyses.filter(a =>
    `${a.job_title} ${a.company}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="My Analyses" subtitle="All your career analyses in one place" />

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-surface w-64">
              <Search size={15} className="text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by job or company…"
                aria-label="Search analyses"
                className="bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none w-full"
              />
            </div>
            <Button onClick={() => navigate('/new-analysis')}>+ New Analysis</Button>
          </div>

          {loading && <Card className="p-6"><SkeletonTable /></Card>}
          {error && <ErrorState message={error} onRetry={load} />}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon="📊"
              title={search ? 'No results found' : 'No analyses yet'}
              description={search ? 'Try a different search term.' : 'Upload your resume and a job description to get started.'}
              action={!search ? { label: 'Start first analysis', onClick: () => navigate('/new-analysis') } : undefined}
            />
          )}

          {!loading && !error && filtered.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border bg-canvas">
                      <th className="px-5 py-3 font-semibold text-ink-muted">Job</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Company</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Score</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Status</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Date</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.id} className="border-b border-border last:border-0 hover:bg-canvas/50">
                        <td className="px-5 py-4 font-medium text-ink">{a.job_title || 'Untitled'}</td>
                        <td className="px-5 py-4 text-ink-muted">{a.company || '—'}</td>
                        <td className="px-5 py-4">
                          {a.overall_score != null ? (
                            <span className="inline-flex items-center justify-center w-10 h-7 rounded-full bg-accent-soft text-accent text-xs font-bold">
                              {Math.round(a.overall_score)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <SkillBadge label={a.status} status={statusBadgeClass(a.status) as any} />
                        </td>
                        <td className="px-5 py-4 text-ink-muted text-xs">
                          {new Date(a.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link to={`/analyses/${a.id}`}
                              className="flex items-center gap-1 text-accent text-xs font-medium hover:underline">
                              <ExternalLink size={13} /> Open
                            </Link>
                            <button
                              onClick={() => setDeleteId(a.id)}
                              aria-label={`Delete analysis for ${a.job_title}`}
                              className="text-ink-muted hover:text-danger transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete analysis?"
        description="This will permanently delete the analysis and all its results. This cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        dangerous
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
