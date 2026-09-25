import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input, PasswordInput } from '../components/Input';
import { Button } from '../components/Button';
import { authApi, ApiError } from '../api/client';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.includes('@')) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Must include an uppercase letter.';
    else if (!/[0-9]/.test(form.password)) e.password = 'Must include a number.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setLoading(true);
    try {
      await authApi.signup(form.email.trim().toLowerCase(), form.password, form.confirm, form.fullName.trim() || undefined);
      navigate('/verify-email', { state: { email: form.email.trim().toLowerCase() } });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.detail : 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setErrors(prev => ({ ...prev, [field]: '' }));
    };
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
            <h1 className="font-display text-2xl font-bold text-ink">Create your account</h1>
            <p className="text-sm text-ink-muted mt-2">Start analyzing your career profile</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
            {serverError && (
              <div role="alert" className="mb-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <Input
                label="Full name (optional)"
                type="text"
                autoComplete="name"
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="Ada Lovelace"
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                required
                placeholder="you@example.com"
              />
              <PasswordInput
                label="Password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(p => ({ ...p, password: e.target.value })); setErrors(p => ({ ...p, password: '' })); }}
                error={errors.password}
                hint="Min 8 characters, one uppercase letter and one number"
              />
              <PasswordInput
                label="Confirm password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(p => ({ ...p, confirm: e.target.value })); setErrors(p => ({ ...p, confirm: '' })); }}
                error={errors.confirm}
              />
              <Button type="submit" loading={loading} className="w-full mt-1">
                Create account
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-ink-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
