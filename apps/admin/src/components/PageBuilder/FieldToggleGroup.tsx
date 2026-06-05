'use client';

/**
 * FieldToggleGroup — segmented icon-button control for low-cardinality
 * enums (align: left/center/right, variant: primary/secondary/ghost, …).
 *
 * Backed by Radix `ToggleGroup` so the group is a single roving
 * tab-stop and arrow keys cycle through the options.
 */

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Field } from './Field.tsx';
import { cn } from '../../lib/utils.ts';

export interface FieldToggleGroupOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

export interface FieldToggleGroupProps {
  id: string;
  label: string;
  description?: string | undefined;
  value: string | undefined;
  options: ReadonlyArray<FieldToggleGroupOption>;
  onChange: (value: string | undefined) => void;
}

export function FieldToggleGroup({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: FieldToggleGroupProps): React.JSX.Element {
  return (
    <Field label={label} description={description}>
      <ToggleGroup.Root
        type="single"
        value={value ?? ''}
        onValueChange={(v) => onChange(v === '' ? undefined : v)}
        className="pb-toggle-group"
        aria-label={label}
        data-testid={id}
      >
        {options.map((opt) => (
          <ToggleGroup.Item
            key={opt.value}
            value={opt.value}
            className={cn('pb-toggle-group__item', value === opt.value && 'pb-toggle-group__item--active')}
            aria-label={opt.label}
            title={opt.label}
          >
            {opt.icon}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </Field>
  );
}
