'use client';

import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils.ts';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, leftIcon, ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leftIcon ? (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 grid place-items-center pl-2"
            style={{ color: 'var(--color-muted-foreground)' }}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input',
            leftIcon ? 'pl-8' : '',
            error ? 'border-red-500' : '',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
