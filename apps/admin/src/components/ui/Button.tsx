'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('btn', VARIANT[variant], SIZE[size], className)}
      disabled={Boolean(disabled) || Boolean(isLoading)}
      aria-busy={isLoading ? true : undefined}
      {...rest}
    >
      {isLoading ? <span aria-hidden="true">…</span> : null}
      {children}
    </button>
  );
});
