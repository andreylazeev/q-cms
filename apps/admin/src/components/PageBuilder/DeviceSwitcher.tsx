'use client';

/**
 * DeviceSwitcher — three icon buttons (Monitor / Tablet / Smartphone)
 * that toggle the canvas's max-width. Sits in the top toolbar
 * (or above the canvas) and is purely presentational; the parent
 * owns the active device and applies it to the canvas frame.
 */

import { Monitor, Smartphone, Tablet } from './icons.tsx';
import { cn } from '../../lib/utils.ts';

export type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICES: ReadonlyArray<{ id: Device; label: string; Icon: typeof Monitor; width: number }> = [
  { id: 'desktop', label: 'Desktop', Icon: Monitor, width: 1280 },
  { id: 'tablet', label: 'Tablet', Icon: Tablet, width: 768 },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone, width: 375 },
];

export interface DeviceSwitcherProps {
  value: Device;
  onChange: (device: Device) => void;
  className?: string;
}

export function DeviceSwitcher({ value, onChange, className }: DeviceSwitcherProps): React.JSX.Element {
  return (
    <div
      className={cn('pb-device-switcher', className)}
      role="toolbar"
      aria-label="Canvas width"
      data-testid="device-switcher"
    >
      {DEVICES.map(({ id, label, Icon, width }) => (
        <button
          key={id}
          type="button"
          className={cn('pb-device-switcher__btn', value === id && 'pb-device-switcher__btn--active')}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          aria-label={`${label} (${width}px)`}
          title={`${label} (${width}px)`}
          data-testid={`device-${id}`}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
