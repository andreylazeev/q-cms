'use client';

import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils.ts';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: readonly SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, placeholder, id, className, ...rest },
  ref,
) {
  const reactId = useId();
  const selectId = id ?? `select-${reactId}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn('input', error ? 'border-red-500' : '', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
});
