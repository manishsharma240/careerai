import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input, PasswordInput } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { authApi, ApiError } from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this server yet.',
  google_denied: 'Google sign-in was cancelled.',
  google_invalid_state: 'Google sign-in session expired. Please try again.',
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Show a clean message if redirected back from a failed Google OAuth attempt
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError && OAUTH_ERROR_MESSAGES[oauthError]) {
      setError(OAUTH_ERROR_MESSAGES[oauthError]);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email.trim().toLowerCase(), password);
      await login(data.access_token, data.refresh_token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    // Google OAuth: redirect to backend which handles the OAuth flow
    window.location.href = `${API_BASE}/auth/google`;
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
            <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
            <p className="text-sm text-ink-muted mt-2">Log in to your CareerAI account</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
            {error && (
              <div role="alert" className="mb-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
              />

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" loading={loading} className="w-full mt-1">
                Log in
              </Button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-ink-muted font-medium">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="text-center text-sm text-ink-muted mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent font-medium hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
