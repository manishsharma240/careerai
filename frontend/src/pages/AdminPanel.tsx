import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BarChart2, Shield, Cpu,
  RefreshCw, Search, AlertTriangle,
  CheckCircle, XCircle, Clock
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, SkeletonCard, SkillBadge } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../api/client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type AdminTab = 'stats' | 'users' | 'analyses' | 'security' | 'ai-usage';

interface Stats {
  total_users: number; verified_users: number;
  total_analyses: number; completed_analyses: number;
  failed_analyses: number; analyses_last_24h: number; total_resumes: number;
}
interface AdminUser {
  id: string; email: string; full_name?: string; role: string;
  email_verified: boolean; is_active: boolean; auth_provider: string;
  created_at: string; last_login_at?: string; analysis_count: number;
}
interface AdminAnalysis {
  id: string; user_email: string; status: string;
  overall_score?: number; created_at: string; completed_at?: string;
}
interface SecurityEvent {
  id: string; event_type: string; severity: string;
  user_id?: string; created_at: string;
}
interface AIUsageRow {
  analysis_id: string; section: string; created_at: string; updated_at: string;
}

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

function StatCard({ label, value, sub, icon }: { label: string; value: number; sub?: string; icon: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="font-display text-3xl font-bold text-ink">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </Card>
  );
}

function severityClass(s: string): 'matched' | 'missing' | 'partial' | 'related' {
  return ({ low: 'matched', medium: 'related', high: 'partial', critical: 'missing' } as Record<string, any>)[s] || 'related';
}

function statusIcon(s: string) {
  if (s === 'completed') return <CheckCircle size={14} className="text-success" />;
  if (s === 'failed') return <XCircle size={14} className="text-danger" />;
  return <Clock size={14} className="text-ink-muted" />;
}

function timeAgo(dt: string) {
  const m = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: 'stats',     label: 'Overview',       icon: BarChart2 },
  { id: 'users',     label: 'Users',          icon: Users },
  { id: 'analyses',  label: 'Analyses',       icon: BarChart2 },
  { id: 'security',  label: 'Security',       icon: Shield },
  { id: 'ai-usage',  label: 'AI Usage',       icon: Cpu },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('stats');
  const [search, setSearch] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analyses, setAnalyses] = useState<AdminAnalysis[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsageRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect non-admins immediately (backend also enforces this)
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'stats')    setStats(await adminFetch<Stats>('/admin/stats'));
      if (tab === 'users')    setUsers(await adminFetch<AdminUser[]>('/admin/users?page_size=50'));
      if (tab === 'analyses') setAnalyses(await adminFetch<AdminAnalysis[]>('/admin/analyses?page_size=50'));
      if (tab === 'security') setEvents(await adminFetch<SecurityEvent[]>('/admin/security?page_size=50'));
      if (tab === 'ai-usage') setAiUsage(await adminFetch<AIUsageRow[]>('/admin/ai-usage?page_size=50'));
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data.');
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filteredUsers = users.filter(u =>
    `${u.email} ${u.full_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Admin Panel" subtitle="Restricted — server-side role check enforced" />

        <main className="flex-1 p-6">
          {/* Tab bar */}
          <div className="flex overflow-x-auto gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit max-w-full">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setSearch(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${tab === t.id ? 'bg-accent text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-canvas'}`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
            <button
              onClick={load}
              aria-label="Refresh"
              className="ml-1 p-2 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && <ErrorState message={error} onRetry={load} />}

          {/* ── Stats ── */}
          {tab === 'stats' && !error && (
            loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1,2,3,4,5,6,7].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users"         value={stats.total_users}          icon="👤" />
                <StatCard label="Verified Users"      value={stats.verified_users}        icon="✅" sub={`${Math.round(stats.verified_users/Math.max(stats.total_users,1)*100)}% verified`} />
                <StatCard label="Total Analyses"      value={stats.total_analyses}        icon="📊" />
                <StatCard label="Completed"           value={stats.completed_analyses}    icon="🎯" />
                <StatCard label="Failed"              value={stats.failed_analyses}       icon="❌" />
                <StatCard label="Last 24h"            value={stats.analyses_last_24h}     icon="⏱️" />
                <StatCard label="Resumes"             value={stats.total_resumes}         icon="📄" />
              </div>
            ) : null
          )}

          {/* ── Users ── */}
          {tab === 'users' && !error && (
            <>
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-surface w-72 mb-4">
                <Search size={14} className="text-ink-muted" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by email or name…" aria-label="Search users"
                  className="bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none w-full"
                />
              </div>
              {loading ? <SkeletonCard /> :
               filteredUsers.length === 0 ? <EmptyState icon="👤" title="No users found" /> : (
                <Card className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-border bg-canvas text-ink-muted text-xs">
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Role</th>
                          <th className="px-4 py-3 font-semibold">Verified</th>
                          <th className="px-4 py-3 font-semibold">Provider</th>
                          <th className="px-4 py-3 font-semibold">Analyses</th>
                          <th className="px-4 py-3 font-semibold">Last login</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-border last:border-0 hover:bg-canvas/50">
                            <td className="px-4 py-3 font-medium text-ink">{u.email}</td>
                            <td className="px-4 py-3 text-ink-muted">{u.full_name || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                ${u.role === 'admin' ? 'bg-violet/10 text-violet' : 'bg-canvas text-ink-muted border border-border'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.email_verified
                                ? <CheckCircle size={15} className="text-success" />
                                : <XCircle size={15} className="text-danger" />}
                            </td>
                            <td className="px-4 py-3 capitalize text-ink-muted">{u.auth_provider}</td>
                            <td className="px-4 py-3 text-ink-muted">{u.analysis_count}</td>
                            <td className="px-4 py-3 text-ink-muted text-xs">
                              {u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ── Analyses ── */}
          {tab === 'analyses' && !error && (
            loading ? <SkeletonCard /> :
            analyses.length === 0 ? <EmptyState icon="📊" title="No analyses yet" /> : (
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-border bg-canvas text-ink-muted text-xs">
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Score</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                        <th className="px-4 py-3 font-semibold">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.map(a => (
                        <tr key={a.id} className="border-b border-border last:border-0 hover:bg-canvas/50">
                          <td className="px-4 py-3 text-ink-muted text-xs">{a.user_email}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {statusIcon(a.status)}
                              <span className="text-xs capitalize text-ink-muted">{a.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {a.overall_score != null
                              ? <span className="font-semibold text-accent">{Math.round(a.overall_score)}</span>
                              : <span className="text-ink-muted">—</span>}
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-xs">{timeAgo(a.created_at)}</td>
                          <td className="px-4 py-3 text-ink-muted text-xs">
                            {a.completed_at ? timeAgo(a.completed_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {/* ── Security Events ── */}
          {tab === 'security' && !error && (
            loading ? <SkeletonCard /> :
            events.length === 0 ? <EmptyState icon="🔒" title="No security events" /> : (
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-border bg-canvas text-ink-muted text-xs">
                        <th className="px-4 py-3 font-semibold">Event</th>
                        <th className="px-4 py-3 font-semibold">Severity</th>
                        <th className="px-4 py-3 font-semibold">User ID</th>
                        <th className="px-4 py-3 font-semibold">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(e => (
                        <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas/50">
                          <td className="px-4 py-3 font-mono text-xs text-ink">{e.event_type}</td>
                          <td className="px-4 py-3">
                            <SkillBadge label={e.severity} status={severityClass(e.severity)} />
                          </td>
                          <td className="px-4 py-3 text-ink-muted font-mono text-xs">
                            {e.user_id ? e.user_id.slice(0, 8) + '…' : '—'}
                          </td>
                          <td className="px-4 py-3 text-ink-muted text-xs">{timeAgo(e.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {/* ── AI Usage ── */}
          {tab === 'ai-usage' && !error && (
            <>
              <div className="mb-4 p-4 rounded-xl border border-border bg-canvas text-sm text-ink-muted flex items-start gap-2">
                <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                Each row is one AI pipeline section result. Monitor for unexpected volume.
                Raw LLM outputs are not shown here — only metadata.
              </div>
              {loading ? <SkeletonCard /> :
               aiUsage.length === 0 ? <EmptyState icon="🤖" title="No AI usage recorded yet" /> : (
                <Card className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-border bg-canvas text-ink-muted text-xs">
                          <th className="px-4 py-3 font-semibold">Analysis ID</th>
                          <th className="px-4 py-3 font-semibold">Section</th>
                          <th className="px-4 py-3 font-semibold">Generated</th>
                          <th className="px-4 py-3 font-semibold">Last updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiUsage.map((r, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-canvas/50">
                            <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                              {r.analysis_id.slice(0, 8)}…
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent">
                                {r.section}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ink-muted text-xs">{timeAgo(r.created_at)}</td>
                            <td className="px-4 py-3 text-ink-muted text-xs">{timeAgo(r.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
