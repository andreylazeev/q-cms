'use client';

/**
 * ValidationBadge — shows a red "N issues" pill next to the
 * inspector header that opens a Radix `Popover` with the list of
 * issues. Returns `null` when there are no issues (the inspector
 * header should be clean by default).
 *
 * The "issues" are simple: required props that are empty strings,
 * plus the obvious one — a missing block spec for the section's
 * type. The actual error UX beyond listing them is out of scope
 * for the rewrite; this is a discoverability affordance.
 */

import * as Popover from '@radix-ui/react-popover';
import type { BlockSpec } from '@q-cms/templates';
import { AlertCircle, ChevronDown } from './icons.tsx';

export interface ValidationIssue {
  /** Short, single-line description. */
  message: string;
  /** Optional field name, used to scroll/highlight later. */
  field?: string;
}

export interface ValidationBadgeProps {
  issues: ReadonlyArray<ValidationIssue>;
  spec: BlockSpec | undefined;
}

export function ValidationBadge({ issues, spec }: ValidationBadgeProps): React.JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="pb-validation-badge"
          data-testid="validation-badge"
          aria-label={`${issues.length} validation issues`}
        >
          <AlertCircle size={12} aria-hidden="true" />
          <span>
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="pb-popover"
          sideOffset={6}
          align="end"
          data-testid="validation-popover"
        >
          <div className="pb-popover__head">Validation issues</div>
          <ul className="pb-popover__list">
            {issues.map((issue, idx) => (
              <li key={`${issue.field ?? 'issue'}-${idx}`} className="pb-popover__item">
                {issue.field ? <code className="pb-popover__field">{issue.field}</code> : null}
                <span className="pb-popover__msg">{issue.message}</span>
                {!spec ? (
                  <span className="pb-popover__hint">No spec registered for this block type.</span>
                ) : null}
              </li>
            ))}
          </ul>
          <Popover.Arrow className="pb-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
