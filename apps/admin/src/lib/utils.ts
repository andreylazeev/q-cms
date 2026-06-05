/**
 * Class-merging helper that mirrors the real `@q-cms/ui` `cn()`.
 * We keep it locally so we don't pull the stub at runtime.
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
