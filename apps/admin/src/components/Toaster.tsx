'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastInput {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: 'var(--color-background)', fg: 'var(--color-foreground)', border: 'var(--color-border)' },
  success: { bg: 'rgba(34,197,94,0.1)', fg: '#166534', border: 'rgba(34,197,94,0.3)' },
  error: { bg: 'rgba(239,68,68,0.1)', fg: '#991b1b', border: 'rgba(239,68,68,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.14)', fg: '#92400e', border: 'rgba(245,158,11,0.3)' },
};

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput): void => {
      idRef.current += 1;
      const id = `t-${idRef.current}`;
      const variant: ToastVariant = input.variant ?? 'default';
      const duration = input.duration ?? 4000;
      setToasts((prev) => [...prev, { id, message: input.message, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (msg) => push({ message: msg, variant: 'success' }),
      error: (msg) => push({ message: msg, variant: 'error' }),
      warning: (msg) => push({ message: msg, variant: 'warning' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 100,
        }}
      >
        {toasts.map((t) => {
          const styles = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className="rounded-md px-3 py-2 text-sm shadow"
              style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}`, minWidth: 220 }}
            >
              {t.message}
              <button
                type="button"
                className="ml-3 text-xs underline"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
