import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { PasswordInput } from '../components/Input';
import { Button } from '../components/Button';
import { authApi, ApiError } from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(password)) e.password = 'Must include an uppercase letter.';
    else if (!/[0-9]/.test(password)) e.password = 'Must include a number.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await authApi.resetPassword(token, password, confirm);
      navigate('/login', { state: { message: 'Password reset successfully. Please log in.' } });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.detail : 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="font-display text-xl font-bold text-ink mb-3">Invalid reset link</h1>
          <p className="text-sm text-ink-muted mb-6">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <Link to="/forgot-password"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">C</div>
          <span className="font-display font-semibold text-ink">CareerAI</span>
        </Link>
        <ThemeToggle />
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🔐</div>
            <h1 className="font-display text-2xl font-bold text-ink">Set new password</h1>
            <p className="text-sm text-ink-muted mt-2">Choose a strong password for your account.</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
            {serverError && (
              <div role="alert" className="mb-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {serverError}
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <PasswordInput
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                error={errors.password}
                hint="Min 8 characters, uppercase letter and number"
              />
              <PasswordInput
                label="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
                error={errors.confirm}
              />
              <Button type="submit" loading={loading} className="w-full mt-1">
                Reset password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
