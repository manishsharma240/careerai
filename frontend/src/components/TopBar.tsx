import { Bell, Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink-muted w-56">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search analyses..."
            aria-label="Search analyses"
            className="w-full bg-transparent text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-ink-muted hover:text-ink transition-colors"
        >
          <Bell size={16} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-semibold text-white flex items-center justify-center">
            1
          </span>
        </button>

        <ThemeToggle />

        <div className="h-9 w-9 rounded-full bg-violet/20 border border-border flex items-center justify-center font-display text-sm font-semibold text-violet">
          A
        </div>
      </div>
    </header>
  );
}
