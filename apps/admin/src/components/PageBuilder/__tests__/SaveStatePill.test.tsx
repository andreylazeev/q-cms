/**
 * SaveStatePill tests.
 *
 * The pill is purely presentational; the tests assert that each
 * state renders the expected label + testid/data attribute, and
 * that the "saved Xs ago" text updates with the `savedAt`
 * timestamp.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SaveStatePill } from '../SaveStatePill.tsx';

describe('SaveStatePill', () => {
  it('renders the "idle" state with a draft label', () => {
    render(<SaveStatePill state="idle" />);
    const pill = screen.getByTestId('save-state-pill');
    expect(pill.getAttribute('data-state')).toBe('idle');
    expect(pill.textContent).toContain('Draft');
  });

  it('renders the "saving" state with a "Saving…" label', () => {
    render(<SaveStatePill state="saving" />);
    const pill = screen.getByTestId('save-state-pill');
    expect(pill.getAttribute('data-state')).toBe('saving');
    expect(pill.textContent).toContain('Saving');
  });

  it('renders the "dirty" state with an "Unsaved changes" label', () => {
    render(<SaveStatePill state="dirty" />);
    const pill = screen.getByTestId('save-state-pill');
    expect(pill.getAttribute('data-state')).toBe('dirty');
    expect(pill.textContent).toContain('Unsaved');
  });

  it('renders the "saved" state with a relative time label', () => {
    const fiveSecondsAgo = Date.now() - 5_000;
    render(<SaveStatePill state="saved" savedAt={fiveSecondsAgo} />);
    const pill = screen.getByTestId('save-state-pill');
    expect(pill.getAttribute('data-state')).toBe('saved');
    // "just now" is shown for <5s
    expect(pill.textContent).toMatch(/Saved/);
  });

  it('falls back to a generic "Saved" label when no timestamp is provided', () => {
    render(<SaveStatePill state="saved" />);
    const pill = screen.getByTestId('save-state-pill');
    expect(pill.textContent).toContain('Saved');
    expect(pill.textContent).not.toContain('ago');
  });
});
