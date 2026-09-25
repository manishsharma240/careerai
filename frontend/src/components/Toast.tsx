import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const icons = { success: CheckCircle, error: XCircle, info: Info };
const styles = {
  success: 'border-l-4 border-success bg-surface',
  error: 'border-l-4 border-danger bg-surface',
  info: 'border-l-4 border-accent bg-surface',
};
const iconStyles = { success: 'text-success', error: 'text-danger', info: 'text-accent' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const success = useCallback((m: string) => toast('success', m), [toast]);
  const error = useCallback((m: string) => toast('error', m), [toast]);
  const info = useCallback((m: string) => toast('info', m), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-80"
      >
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              className={`flex items-start gap-3 rounded-xl shadow-card p-4 ${styles[t.type]} animate-in slide-in-from-right-4`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${iconStyles[t.type]}`} />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-ink-muted hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
