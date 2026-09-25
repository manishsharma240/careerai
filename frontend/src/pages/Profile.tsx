import { useState, type FormEvent } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { Input, PasswordInput } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { ApiError } from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('careerai_access')}`,
        },
        body: JSON.stringify({ full_name: name.trim() }),
      });
      if (!res.ok) throw new ApiError(res.status, 'Failed to update name.');
      toast.success('Name updated.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Could not update name.');
    } finally { setSavingName(false); }
  }

  function validatePw() {
    const e: Record<string, string> = {};
    if (!passwords.current) e.current = 'Enter your current password.';
    if (passwords.next.length < 8) e.next = 'New password must be at least 8 characters.';
    else if (!/[A-Z]/.test(passwords.next)) e.next = 'Must include an uppercase letter.';
    else if (!/[0-9]/.test(passwords.next)) e.next = 'Must include a number.';
    if (passwords.confirm !== passwords.next) e.confirm = 'Passwords do not match.';
    return e;
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const errs = validatePw();
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwErrors({});
    setSavingPw(true);
    try {
      const res = await fetch(`${API_BASE}/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('careerai_access')}` },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.next }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new ApiError(res.status, d.detail || 'Failed to change password.');
      }
      toast.success('Password changed. All other sessions were logged out.');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Could not change password.');
    } finally { setSavingPw(false); }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Profile" subtitle="Manage your account information" />

        <main className="flex-1 p-6 max-w-xl flex flex-col gap-6">
          {/* Account info */}
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink mb-5">Account Information</h2>
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-ink-muted">Email</span>
                <span className="text-ink font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-ink-muted">Email verified</span>
                <span className={user?.email_verified ? 'text-success font-medium' : 'text-danger font-medium'}>
                  {user?.email_verified ? '✓ Verified' : '✗ Not verified'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-ink-muted">Account type</span>
                <span className="text-ink capitalize">{user?.auth_provider || 'Email'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-muted">Role</span>
                <span className="text-ink capitalize">{user?.role || 'user'}</span>
              </div>
            </div>
          </Card>

          {/* Edit name */}
          <Card className="p-6">
            <h2 className="font-display font-semibold text-ink mb-5">Display Name</h2>
            <form onSubmit={saveName} className="flex gap-3">
              <Input
                aria-label="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="flex-1"
              />
              <Button type="submit" loading={savingName} variant="secondary">Save</Button>
            </form>
          </Card>

          {/* Change password — only for email auth users */}
          {user?.auth_provider === 'email' && (
            <Card className="p-6">
              <h2 className="font-display font-semibold text-ink mb-5">Change Password</h2>
              <form onSubmit={changePassword} noValidate className="flex flex-col gap-4">
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords(p => ({ ...p, current: e.target.value })); setPwErrors(p => ({ ...p, current: '' })); }}
                  error={pwErrors.current}
                />
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords(p => ({ ...p, next: e.target.value })); setPwErrors(p => ({ ...p, next: '' })); }}
                  error={pwErrors.next}
                  hint="Min 8 characters, uppercase letter and number"
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPasswords(p => ({ ...p, confirm: e.target.value })); setPwErrors(p => ({ ...p, confirm: '' })); }}
                  error={pwErrors.confirm}
                />
                <Button type="submit" loading={savingPw} className="w-full">Change password</Button>
              </form>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
