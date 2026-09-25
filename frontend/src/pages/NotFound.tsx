import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">C</div>
          <span className="font-display font-semibold text-ink">CareerAI</span>
        </Link>
        <ThemeToggle />
      </nav>
      <div className="flex-1 flex items-center justify-center text-center p-6">
        <div>
          <p className="font-display text-7xl font-bold text-accent mb-4">404</p>
          <h1 className="font-display text-2xl font-semibold text-ink mb-3">Page not found</h1>
          <p className="text-ink-muted mb-8 max-w-xs">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
