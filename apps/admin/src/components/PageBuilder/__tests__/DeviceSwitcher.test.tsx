/**
 * DeviceSwitcher tests.
 *
 * Verifies the three-device toggle renders all options, the
 * active one is marked via aria-pressed, and clicking a different
 * option fires onChange with the new device id.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceSwitcher } from '../DeviceSwitcher.tsx';

describe('DeviceSwitcher', () => {
  it('renders the three device buttons', () => {
    render(<DeviceSwitcher value="desktop" onChange={() => {}} />);
    expect(screen.getByTestId('device-desktop')).toBeTruthy();
    expect(screen.getByTestId('device-tablet')).toBeTruthy();
    expect(screen.getByTestId('device-mobile')).toBeTruthy();
  });

  it('marks the active device with aria-pressed="true"', () => {
    render(<DeviceSwitcher value="tablet" onChange={() => {}} />);
    expect((screen.getByTestId('device-tablet') as HTMLButtonElement).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect((screen.getByTestId('device-desktop') as HTMLButtonElement).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('fires onChange with the new device when clicked', () => {
    const onChange = vi.fn();
    render(<DeviceSwitcher value="desktop" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('device-mobile'));
    expect(onChange).toHaveBeenCalledWith('mobile');
  });
});
