import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, LogOut, Trash2, RefreshCw } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { authApi, getAccessToken } from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Session {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
}

function parseDevice(ua: string | null) {
  if (!ua) return { name: 'Unknown device', icon: Monitor };
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return { name: 'Mobile browser', icon: Smartphone };
  }
  if (lower.includes('chrome')) return { name: 'Chrome', icon: Monitor };
  if (lower.includes('firefox')) return { name: 'Firefox', icon: Monitor };
  if (lower.includes('safari')) return { name: 'Safari', icon: Monitor };
  return { name: 'Browser', icon: Monitor };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function Settings() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function loadSessions() {
    setLoadingSessions(true); setSessionsError('');
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load sessions.');
      setSessions(await res.json());
    } catch {
      setSessionsError('Could not load sessions. Please try again.');
    } finally { setLoadingSessions(false); }
  }

  useEffect(() => { loadSessions(); }, []);

  async function revokeSession(id: string) {
    setRevokingId(id);
    try {
      const token = getAccessToken();
      await fetch(`${API_BASE}/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      toast.success('Session revoked.');
    } catch {
      toast.error('Could not revoke session.');
    } finally { setRevokingId(null); }
  }

  async function logoutAll() {
    setLogoutAllLoading(true);
    try {
      await authApi.logout();
      logout();
      navigate('/login');
    } catch {
      toast.error('Could not log out all sessions.');
    } finally { setLogoutAllLoading(false); }
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      logout();
      navigate('/');
      toast.success('Account deleted.');
    } catch {
      toast.error('Could not delete account. Please contact support.');
    } finally { setDeletingAccount(false); setConfirmDeleteAccount(false); }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Settings" subtitle="Security and account settings" />

        <main className="flex-1 p-6 max-w-xl flex flex-col gap-6">

          {/* Active Sessions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-ink">Active Sessions</h2>
              <button onClick={loadSessions} aria-label="Refresh sessions"
                className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>

            {loadingSessions && (
              <div className="flex flex-col gap-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1"><Skeleton className="h-3 w-32 mb-2" /><Skeleton className="h-3 w-20" /></div>
                  </div>
                ))}
              </div>
            )}

            {sessionsError && <ErrorState message={sessionsError} onRetry={loadSessions} />}

            {!loadingSessions && !sessionsError && sessions.length === 0 && (
              <EmptyState icon="🔒" title="No active sessions" description="Your sessions will appear here." />
            )}

            {!loadingSessions && !sessionsError && sessions.length > 0 && (
              <div className="flex flex-col gap-3">
                {sessions.map(s => {
                  const device = parseDevice(s.user_agent);
                  const Icon = device.icon;
                  return (
                    <div key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                        ${s.is_current ? 'border-accent/30 bg-accent-soft' : 'border-border bg-canvas'}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                        ${s.is_current ? 'bg-accent text-white' : 'bg-surface-raised text-ink-muted'}`}>
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {device.name}
                          {s.is_current && (
                            <span className="ml-2 text-xs font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-muted">{timeAgo(s.last_seen_at)}</p>
                      </div>
                      {!s.is_current && (
                        <button
                          onClick={() => revokeSession(s.id)}
                          disabled={revokingId === s.id}
                          aria-label="Revoke this session"
                          className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
                        >
                          <LogOut size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sessions.length > 1 && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-4"
                loading={logoutAllLoading}
                onClick={logoutAll}
              >
                <LogOut size={14} /> Log out all other sessions
              </Button>
            )}
          </Card>

          {/* Privacy & Data */}
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink mb-5">Privacy & Data</h2>
            <div className="flex flex-col gap-3 text-sm text-ink-muted mb-6">
              <p>Your resume files, job descriptions and analyses are private and can only be accessed by you.</p>
              <p>You can delete individual analyses and resumes from their respective pages.</p>
            </div>
            <div className="border-t border-border pt-5">
              <h3 className="font-medium text-danger mb-2">Danger Zone</h3>
              <p className="text-sm text-ink-muted mb-4">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDeleteAccount(true)}
              >
                <Trash2 size={14} /> Delete my account
              </Button>
            </div>
          </Card>

        </main>
      </div>

      <ConfirmDialog
        open={confirmDeleteAccount}
        title="Delete your account?"
        description="This will permanently delete your account, all resumes, analyses, and results. This action cannot be undone."
        confirmLabel={deletingAccount ? 'Deleting…' : 'Yes, delete my account'}
        dangerous
        onConfirm={deleteAccount}
        onCancel={() => setConfirmDeleteAccount(false)}
      />
    </div>
  );
}
