'use client';

/**
 * FieldSwitch — boolean prop editor built on Radix `Switch`.
 *
 * Renders a pill-shaped toggle to the right of the label so the
 * whole row reads as a single control.
 */

import * as Switch from '@radix-ui/react-switch';
import { Field } from './Field.tsx';

export interface FieldSwitchProps {
  id: string;
  label: string;
  description?: string | undefined;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function FieldSwitch({ id, label, description, value, onChange }: FieldSwitchProps): React.JSX.Element {
  return (
    <Field label={label} description={description} htmlFor={id}>
      <div className="pb-field__inline">
        <Switch.Root
          id={id}
          checked={value}
          onCheckedChange={onChange}
          className="pb-switch"
          data-testid={id}
        >
          <Switch.Thumb className="pb-switch__thumb" />
        </Switch.Root>
        <span className="pb-field__inline-label">{value ? 'On' : 'Off'}</span>
      </div>
    </Field>
  );
}
