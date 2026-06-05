/**
 * BlockCard tests.
 *
 * Asserts the high-level structure of the card: header / body /
 * footer, no raw JSON, action buttons present. We mount the card
 * with a real `hero` block from the templates registry.
 */
import { getBlockSpec, registerBuiltinBlocks } from '@q-cms/templates';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockCard } from '../BlockCard.tsx';
import type { SdkTemplateSection } from '../../../lib/stubs/api-client.ts';

registerBuiltinBlocks();

function makeSection(): SdkTemplateSection {
  return {
    id: 'sec_1',
    type: 'hero',
    props: {
      eyebrow: 'Welcome',
      headline: 'Building the next-gen headless CMS',
      description: 'Engineering, product, and process notes from the team behind Q-CMS.',
      ctaLabel: 'Browse articles',
      ctaHref: '/articles/',
      imageId: 'm_hero',
      align: 'left',
    },
  };
}

const HERO_SPEC = getBlockSpec('hero');

describe('BlockCard', () => {
  it('renders the block title in the header', () => {
    render(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={0}
        isFirst
        isLast
        isSelected={false}
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={7}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    expect(screen.getByText('Hero')).toBeTruthy();
  });

  it('does NOT render the raw props JSON in the body', () => {
    const { container } = render(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={0}
        isFirst
        isLast
        isSelected={false}
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={7}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain('"eyebrow"');
    expect(html).not.toContain('"headline"');
    // Also: the literal "JSON.stringify" output pattern is forbidden.
    expect(html).not.toMatch(/\\"eyebrow\\":/);
  });

  it('renders the up, down, duplicate, edit, and remove buttons with proper aria labels', () => {
    render(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={0}
        isFirst
        isLast
        isSelected={false}
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={7}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    expect(screen.getByLabelText('Move Hero up')).toBeTruthy();
    expect(screen.getByLabelText('Move Hero down')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate Hero')).toBeTruthy();
    expect(screen.getByLabelText('Edit Hero')).toBeTruthy();
    expect(screen.getByLabelText('Remove Hero')).toBeTruthy();
  });

  it('disables up on the first section and down on the last', () => {
    const { rerender } = render(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={0}
        isFirst
        isLast={false}
        isSelected={false}
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={1}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    expect((screen.getByLabelText('Move Hero up') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Hero down') as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={4}
        isFirst={false}
        isLast
        isSelected={false}
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={1}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    expect((screen.getByLabelText('Move Hero down') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks the card as selected when isSelected is true', () => {
    render(
      <BlockCard
        section={makeSection()}
        spec={HERO_SPEC}
        index={0}
        isFirst
        isLast
        isSelected
        isDropTarget={false}
        isDragging={false}
        configuredPropCount={1}
        onSelect={() => {}}
        onMove={() => {}}
        onDuplicate={() => {}}
        onRemove={() => {}}
        onToggleInline={() => {}}
        isInlineExpanded={false}
      />,
    );
    const card = screen.getByTestId('canvas-section-sec_1');
    expect(card.getAttribute('data-selected')).toBe('true');
  });
});
