import { type EntryStatus, type UserStatus } from '@q-cms/core';
import { cn } from '../lib/utils.ts';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps {
  /** Status string — either EntryStatus, UserStatus, or arbitrary. */
  status: EntryStatus | UserStatus | string;
  /** Optional override tone. */
  tone?: BadgeTone;
  className?: string;
}

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'info',
  published: 'success',
  archived: 'neutral',
  active: 'success',
  inactive: 'neutral',
  pending: 'warning',
  success: 'success',
  failed: 'danger',
  exhausted: 'danger',
};

const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'var(--color-muted)', fg: 'var(--color-muted-foreground)', border: 'var(--color-border)' },
  info: { bg: 'rgba(59,130,246,0.12)', fg: '#1d4ed8', border: 'rgba(59,130,246,0.3)' },
  success: { bg: 'rgba(34,197,94,0.12)', fg: '#15803d', border: 'rgba(34,197,94,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.14)', fg: '#b45309', border: 'rgba(245,158,11,0.3)' },
  danger: { bg: 'rgba(239,68,68,0.12)', fg: '#b91c1c', border: 'rgba(239,68,68,0.3)' },
};

/** Compact pill that renders a status string with a tone-matching color. */
export function StatusBadge({ status, tone, className }: StatusBadgeProps): React.JSX.Element {
  const resolvedTone: BadgeTone = tone ?? TONE_BY_STATUS[status] ?? 'neutral';
  const styles = TONE_STYLES[resolvedTone];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', className)}
      style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}` }}
      data-status={status}
      data-tone={resolvedTone}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: styles.fg }}
      />
      {humanize(status)}
    </span>
  );
}

function humanize(value: string): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}
