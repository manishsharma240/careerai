import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button } from '../components/Button';
import { authApi, ApiError } from '../api/client';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as { email?: string })?.email || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.verifyEmail(email, code);
      setSuccess('Email verified! Redirecting to login…');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email) return;
    setResending(true);
    setError('');
    try {
      await authApi.resendOtp(email);
      setSuccess('A new code has been sent to your email.');
      setCooldown(60);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-muted mb-4">No email address found.</p>
          <Link to="/signup" className="text-accent hover:underline">Go back to signup</Link>
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
            <div className="text-4xl mb-4">📧</div>
            <h1 className="font-display text-2xl font-bold text-ink">Check your email</h1>
            <p className="text-sm text-ink-muted mt-2">
              We sent a 6-digit code to <strong className="text-ink">{email}</strong>
            </p>
            <p className="text-xs text-ink-muted mt-1">The code expires in 10 minutes.</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
            {error && (
              <div role="alert" className="mb-5 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="mb-5 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <fieldset>
                <legend className="text-sm font-medium text-ink mb-3 block">Verification code</legend>
                <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      aria-label={`Digit ${i + 1}`}
                      className="w-11 h-12 text-center text-xl font-bold rounded-lg border border-border bg-canvas text-ink
                        focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                    />
                  ))}
                </div>
              </fieldset>

              <Button type="submit" loading={loading} className="w-full">
                Verify email
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-ink-muted">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="text-accent font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>

            <div className="mt-3 text-center text-xs text-ink-muted">
              Wrong email?{' '}
              <Link to="/signup" className="text-accent hover:underline">Go back</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
