import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    // Tokens arrive in the URL fragment (#...), never a query param, so they
    // are never sent to any server or recorded in access logs.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setError('Google sign-in did not complete. Please try again.');
      return;
    }

    login(accessToken, refreshToken).then(() => {
      // Clear the fragment from the URL bar before navigating away
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/dashboard', { replace: true });
    });
  }, [login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="font-display text-xl font-bold text-ink mb-3">Sign-in failed</h1>
          <p className="text-sm text-ink-muted mb-6">{error}</p>
          <Link to="/login" className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-ink-muted">Signing you in…</p>
      </div>
    </div>
  );
}
