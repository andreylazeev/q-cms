/**
 * PageBuilder smoke test.
 *
 * Renders the full PageBuilder with a stub template and asserts
 * that the three columns (palette, canvas, inspector) and the top
 * toolbar are all present. We mock the API client and the Next
 * router so the test doesn't hit the network or require an app
 * router context.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageBuilder } from '../PageBuilder.tsx';
import type { SdkTemplate } from '../../../lib/stubs/api-client.ts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    back: () => {},
    replace: () => {},
    refresh: () => {},
  }),
}));

vi.mock('../../../components/Toaster.tsx', () => ({
  useToast: () => ({
    toast: () => {},
    success: () => {},
    error: () => {},
    warning: () => {},
    dismiss: () => {},
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the API client so the test doesn't hit the network.
vi.mock('../../../lib/api-client.ts', () => ({
  getApiClient: () => ({
    templates: {
      list: async () => [],
      get: async () => null,
      create: async () => null,
      update: async (_id: string, data: Partial<SdkTemplate>) => data as SdkTemplate,
      delete: async () => {},
    },
    media: {
      list: async () => [],
    },
  }),
}));

const TEMPLATE: SdkTemplate = {
  id: 'tpl_test',
  slug: 'test',
  name: 'Test template',
  description: 'Smoke test template',
  locale: 'en',
  sections: [
    {
      id: 'sec_1',
      type: 'hero',
      props: { eyebrow: 'Hello', headline: 'World', description: 'A test', ctaLabel: 'Go', ctaHref: '/' },
    },
  ],
  meta: {},
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
};

describe('PageBuilder', () => {
  it('renders the three columns and the top toolbar', () => {
    render(<PageBuilder template={TEMPLATE} />);
    expect(screen.getByTestId('page-builder')).toBeTruthy();
    expect(screen.getByTestId('page-builder-toolbar')).toBeTruthy();
    expect(screen.getByTestId('block-palette')).toBeTruthy();
    expect(screen.getByTestId('page-builder-canvas')).toBeTruthy();
    expect(screen.getByTestId('block-editor')).toBeTruthy();
  });

  it('shows the template name and slug in the toolbar', () => {
    render(<PageBuilder template={TEMPLATE} />);
    const name = screen.getByTestId('page-builder-name') as HTMLInputElement;
    expect(name.value).toBe('Test template');
    expect(screen.getByTestId('page-builder-slug').textContent).toContain('test');
  });

  it('renders a device switcher in the toolbar', () => {
    render(<PageBuilder template={TEMPLATE} />);
    expect(screen.getByTestId('device-switcher')).toBeTruthy();
  });

  it('renders a theme switcher in the toolbar', () => {
    render(<PageBuilder template={TEMPLATE} />);
    expect(screen.getByTestId('theme-switcher')).toBeTruthy();
  });

  it('toggles the device frame when a different device is picked', async () => {
    render(<PageBuilder template={TEMPLATE} />);
    const mobile = await waitFor(() => screen.getByTestId('device-mobile'));
    fireEvent.click(mobile);
    const frame = screen.getByTestId('device-frame');
    // The frame should reflect the new device.
    expect(frame.parentElement?.getAttribute('data-device')).toBe('mobile');
  });
});
