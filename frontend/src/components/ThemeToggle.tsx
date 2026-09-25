import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-surface-raised px-1 transition-colors hover:border-accent/40"
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-transform duration-200"
        style={{ transform: isDark ? 'translateX(28px)' : 'translateX(0px)' }}
      >
        {isDark ? <Moon size={15} /> : <Sun size={15} />}
      </span>
    </button>
  );
}
