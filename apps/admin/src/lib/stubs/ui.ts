/**
 * Local stub for `@q-cms/ui`. Mirrors the `cn()` utility the real
 * package exposes — used by class-merging helpers in the admin app.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
