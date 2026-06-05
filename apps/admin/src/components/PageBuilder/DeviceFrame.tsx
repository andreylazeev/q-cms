'use client';

/**
 * DeviceFrame — wraps the canvas in a max-width container that
 * reflects the active device (1280 / 768 / 375). Adds a small
 * device chrome (a thin border + corner radius on tablet/mobile)
 * to make the constraint visible to the user. On desktop the
 * frame expands to fill its grid cell.
 *
 * Pure presentational; pairs with `DeviceSwitcher` which owns the
 * state.
 */

import type { ReactNode } from 'react';
import { type Device } from './DeviceSwitcher.tsx';
import { cn } from '../../lib/utils.ts';

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const DEVICE_LABEL: Record<Device, string> = {
  desktop: '1280 px',
  tablet: '768 px',
  mobile: '375 px',
};

export interface DeviceFrameProps {
  device: Device;
  children: ReactNode;
  className?: string;
}

export function DeviceFrame({ device, children, className }: DeviceFrameProps): React.JSX.Element {
  return (
    <div className={cn('pb-device-frame', `pb-device-frame--${device}`, className)} data-device={device}>
      <div
        className="pb-device-frame__inner"
        style={{ maxWidth: DEVICE_WIDTHS[device] }}
        data-testid="device-frame"
      >
        <div className="pb-device-frame__bar" aria-hidden="true">
          <span className="pb-device-frame__bar-dot" />
          <span className="pb-device-frame__bar-dot" />
          <span className="pb-device-frame__bar-dot" />
          <span className="pb-device-frame__bar-meta">{DEVICE_LABEL[device]}</span>
        </div>
        <div className="pb-device-frame__content">{children}</div>
      </div>
    </div>
  );
}
