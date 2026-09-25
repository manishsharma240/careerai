import React from "react";
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-invalid={!!error}
          className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors
            ${error ? 'border-danger focus:outline-none focus:ring-2 focus:ring-danger/30' : 'border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'}
            disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-ink-muted">{hint}</p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function PasswordInput({ label = 'Password', ...props }: InputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor="password" className="text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <input
          id="password"
          type={show ? 'text' : 'password'}
          className={`w-full rounded-lg border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted transition-colors
            focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
            ${props.error ? 'border-danger focus:ring-danger/30' : ''}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {props.error && (
        <p className="text-xs text-danger" role="alert">{props.error}</p>
      )}
    </div>
  );
}
