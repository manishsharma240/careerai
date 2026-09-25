import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authApi } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      // Always show the same message — prevents email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
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
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <div className="text-4xl mb-4">🔑</div>
                <h1 className="font-display text-2xl font-bold text-ink">Forgot your password?</h1>
                <p className="text-sm text-ink-muted mt-2">
                  Enter your email and we'll send a reset link if an account exists.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
                {error && (
                  <div role="alert" className="mb-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <Input
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@example.com"
                    required
                  />
                  <Button type="submit" loading={loading} className="w-full mt-1">
                    Send reset link
                  </Button>
                </form>
              </div>

              <p className="text-center text-sm text-ink-muted mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-accent font-medium hover:underline">Log in</Link>
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-8 shadow-card text-center">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="font-display text-xl font-bold text-ink mb-3">Check your inbox</h2>
              <p className="text-sm text-ink-muted mb-6">
                If <strong className="text-ink">{email}</strong> is registered, you'll receive a
                password reset link shortly. The link expires in 30 minutes.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
