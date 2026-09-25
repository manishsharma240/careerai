
import { Button } from './Button';

// ── Empty State ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-ink mb-2">{title}</h3>
      {description && <p className="text-sm text-ink-muted max-w-xs">{description}</p>}
      {action && (
        <Button className="mt-6" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────────────
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="font-display font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-muted max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-border ${className}`} aria-hidden />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-card">
      <Skeleton className="h-4 w-1/3 mb-4" />
      <Skeleton className="h-8 w-2/3 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ── Processing Steps ──────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  'Resume Processing',
  'Skill Extraction',
  'Job Description Analysis',
  'Skill Gap Detection',
  'ATS Analysis',
  'Project Recommendations',
  'Interview Preparation',
  'Learning Roadmap',
];

interface ProgressStepsProps {
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export function ProgressSteps({ status }: ProgressStepsProps) {
  return (
    <div className="flex flex-col gap-3">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone = status === 'completed';
        const isFailed = status === 'failed';
        const isActive = status === 'processing';
        return (
          <div key={step} className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0
              ${isDone ? 'bg-success text-white'
                : isFailed ? 'bg-danger text-white'
                : isActive && i === 0 ? 'bg-accent text-white animate-pulse'
                : 'bg-border text-ink-muted'}`}>
              {isDone ? '✓' : isFailed ? '✗' : i + 1}
            </div>
            <span className={`text-sm ${isDone ? 'text-success font-medium' : 'text-ink-muted'}`}>
              {step}
            </span>
            {isActive && i === 0 && (
              <svg className="ml-auto animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm',
  onConfirm, onCancel, dangerous = false,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 id="dialog-title" className="font-display font-semibold text-ink mb-2">{title}</h2>
        <p className="text-sm text-ink-muted mb-6">{description}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={dangerous ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Skill Badge ───────────────────────────────────────────────────────────────
interface SkillBadgeProps { label: string; status?: 'matched' | 'missing' | 'partial' | 'related' }

export function SkillBadge({ label, status }: SkillBadgeProps) {
  const styles = {
    matched: 'bg-success/10 text-success border-success/20',
    missing: 'bg-danger/10 text-danger border-danger/20',
    partial: 'bg-warning/10 text-warning border-warning/20',
    related: 'bg-accent/10 text-accent border-accent/20',
    default: 'bg-canvas text-ink-muted border-border',
  };
  const cls = status ? styles[status] : styles.default;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
