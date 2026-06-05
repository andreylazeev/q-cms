'use client';

/**
 * FieldSelect — enum prop editor built on Radix `Select`.
 *
 * Wraps the Radix primitives with the field chrome and a
 * "no selection" placeholder that maps to `undefined` (so the prop
 * stays absent and falls back to the spec's default).
 */

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from './icons.tsx';
import { Field } from './Field.tsx';

export interface FieldSelectOption {
  value: string;
  label: string;
}

export interface FieldSelectProps {
  id: string;
  label: string;
  description?: string | undefined;
  value: string | undefined;
  options: ReadonlyArray<FieldSelectOption>;
  /** Placeholder shown when no value is selected. */
  placeholder?: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function FieldSelect({
  id,
  label,
  description,
  value,
  options,
  placeholder = '(default)',
  onChange,
}: FieldSelectProps): React.JSX.Element {
  return (
    <Field label={label} description={description} htmlFor={id}>
      <Select.Root
        value={value ?? ''}
        onValueChange={(v) => onChange(v === '' ? undefined : v)}
        name={id}
      >
        <Select.Trigger
          id={id}
          className="pb-select-trigger"
          aria-label={label}
          data-testid={id}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon className="pb-select-icon">
            <ChevronDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="pb-select-content" position="popper" sideOffset={4}>
            <Select.Viewport className="pb-select-viewport">
              <Select.Item value="" className="pb-select-item">
                <Select.ItemText>{placeholder}</Select.ItemText>
                <Select.ItemIndicator className="pb-select-indicator">
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
              {options.map((opt) => (
                <Select.Item key={opt.value} value={opt.value} className="pb-select-item">
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="pb-select-indicator">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </Field>
  );
}
