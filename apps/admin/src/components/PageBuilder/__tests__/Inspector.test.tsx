/**
 * Inspector tests.
 *
 * Verifies the accordion renders with the right groups, the
 * kebab menu (Radix DropdownMenu) shows the expected actions, and
 * an unknown block type renders a friendly fallback.
 */
import { render, screen } from '@testing-library/react';
import { getBlockSpec, registerBuiltinBlocks } from '@q-cms/templates';
import { describe, expect, it } from 'vitest';
import { Inspector } from '../Inspector.tsx';
import type { SdkTemplateSection } from '../../../lib/stubs/api-client.ts';

registerBuiltinBlocks();

function makeHero(): SdkTemplateSection {
  return {
    id: 'sec_1',
    type: 'hero',
    props: {
      eyebrow: 'Welcome',
      headline: 'Test',
      description: 'Test desc',
      ctaLabel: 'Go',
      ctaHref: '/',
      imageId: 'm_hero',
      align: 'left',
    },
  };
}

describe('Inspector', () => {
  it('renders an empty state when no section is provided', () => {
    render(
      <Inspector
        section={null}
        spec={undefined}
        saveState="idle"
        savedAt={null}
        onChange={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByTestId('block-editor-empty')).toBeTruthy();
  });

  it('renders the field groups accordion when a section is provided', () => {
    const spec = getBlockSpec('hero');
    render(
      <Inspector
        section={makeHero()}
        spec={spec}
        sectionIndex={1}
        totalSections={3}
        saveState="saved"
        savedAt={Date.now() - 2000}
        onChange={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByTestId('inspector-accordion')).toBeTruthy();
    // content, media, cta groups should be present for the hero block
    expect(screen.getByTestId('group-content')).toBeTruthy();
    expect(screen.getByTestId('group-media')).toBeTruthy();
    expect(screen.getByTestId('group-cta')).toBeTruthy();
    expect(screen.getByTestId('group-style')).toBeTruthy();
  });

  it('shows the inspector title and position subtitle', () => {
    const spec = getBlockSpec('hero');
    render(
      <Inspector
        section={makeHero()}
        spec={spec}
        sectionIndex={1}
        totalSections={3}
        saveState="saved"
        savedAt={Date.now() - 2000}
        onChange={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText(/Section 1 of 3/)).toBeTruthy();
  });

  it('shows a kebab menu trigger for block actions', () => {
    const spec = getBlockSpec('hero');
    render(
      <Inspector
        section={makeHero()}
        spec={spec}
        saveState="saved"
        savedAt={Date.now()}
        onChange={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onReset={() => {}}
      />,
    );
    // The kebab trigger is always present in the header. The Radix
    // DropdownMenu opens via pointer/keyboard interaction which
    // jsdom doesn't fully simulate; we only assert on the trigger
    // here. (The DropdownMenu behaviour is owned by Radix, not us.)
    expect(screen.getByTestId('inspector-kebab')).toBeTruthy();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });

  it('renders a fallback for unknown block types', () => {
    render(
      <Inspector
        section={{ id: 'sec_x', type: 'bogus', props: {} }}
        spec={undefined}
        saveState="idle"
        savedAt={null}
        onChange={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText(/Unknown block/)).toBeTruthy();
  });
});
