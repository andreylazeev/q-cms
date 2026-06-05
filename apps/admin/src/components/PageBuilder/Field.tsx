'use client';

/**
 * Field — generic wrapper that gives every property editor a
 * consistent vertical rhythm:
 *
 *   Label (12px, 600)
 *   Description (12px, muted, optional)
 *   <input />
 *   Error (12px, danger, optional)
 *
 * Each concrete field component (FieldSwitch, FieldSelect, etc.)
 * is responsible only for its own input — Field handles the chrome.
 */

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

export interface FieldProps {
  label: string;
  description?: string | undefined;
  error?: string | undefined;
  /** Override id when wrapping a non-input element. */
  htmlFor?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function Field({ label, description, error, htmlFor, className, children }: FieldProps): React.JSX.Element {
  return (
    <div className={cn('pb-field', className)}>
      <label className="pb-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {description ? <p className="pb-field__description">{description}</p> : null}
      <div className="pb-field__control">{children}</div>
      {error ? (
        <p className="pb-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
