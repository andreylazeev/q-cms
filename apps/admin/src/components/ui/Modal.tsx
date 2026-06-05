'use client';

import { type ReactNode, useEffect } from 'react';
import { cn } from '../../lib/utils.ts';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal(props: ModalProps): React.JSX.Element | null {
  const { open, onClose, title, description, children, footer, size = 'md' } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={cn('card w-full', SIZE[size])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
            {description}
          </p>
        ) : null}
        <div>{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
