'use client';

/**
 * FieldGroup — Radix `Accordion` row for a category of fields
 * (Content / Media / CTA / Style / Advanced).
 *
 * The parent renders the `<Accordion.Root>` once and drops one of
 * these per category. `defaultOpen` controls whether the row is
 * expanded on first mount; the user can still toggle them
 * individually because the root is `type="multiple"`.
 */

import * as Accordion from '@radix-ui/react-accordion';
import type { ReactNode } from 'react';
import { ChevronDown } from './icons.tsx';

export interface FieldGroupProps {
  value: string;
  label: string;
  description?: string | undefined;
  defaultOpen?: boolean | undefined;
  children: ReactNode;
}

export function FieldGroup({
  value,
  label,
  description,
  defaultOpen: _defaultOpen = false,
  children,
}: FieldGroupProps): React.JSX.Element {
  return (
    <Accordion.Item value={value} className="pb-accordion-item" data-testid={`group-${value}`}>
      <Accordion.Header asChild>
        <Accordion.Trigger className="pb-accordion-trigger" data-testid={`group-trigger-${value}`}>
          <span className="pb-accordion-trigger__main">
            <span className="pb-accordion-trigger__label">{label}</span>
            {description ? <span className="pb-accordion-trigger__hint">{description}</span> : null}
          </span>
          <ChevronDown size={14} className="pb-accordion-trigger__chevron" aria-hidden="true" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="pb-accordion-content">
        <div className="pb-accordion-content__inner">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
