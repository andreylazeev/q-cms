import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockHandle, type BlockAction } from '../src/components/Editor/BlockHandle.tsx';

describe('BlockHandle visibility', () => {
  it('starts hidden (data-visible="false")', () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        onAction={() => {}}
      />,
    );
    const handle = screen.getByTestId('block-handle-b_1');
    expect(handle.getAttribute('data-visible')).toBe('false');
  });

  it('becomes visible on mouseEnter', () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        onAction={() => {}}
      />,
    );
    const handle = screen.getByTestId('block-handle-b_1');
    fireEvent.mouseEnter(handle);
    expect(handle.getAttribute('data-visible')).toBe('true');
  });

  it('hides after mouseleave + grace period', async () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        onAction={() => {}}
      />,
    );
    const handle = screen.getByTestId('block-handle-b_1');
    fireEvent.mouseEnter(handle);
    expect(handle.getAttribute('data-visible')).toBe('true');
    fireEvent.mouseLeave(handle);
    // Still visible during the 200ms grace period.
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(handle.getAttribute('data-visible')).toBe('true');
    // After the grace period, it hides.
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    expect(handle.getAttribute('data-visible')).toBe('false');
  });

  it('stays visible while focused', () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        focused
        onAction={() => {}}
      />,
    );
    const handle = screen.getByTestId('block-handle-b_1');
    expect(handle.getAttribute('data-visible')).toBe('true');
  });

  it('renders a drag grip and a `+` insert button', () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        focused
        onAction={() => {}}
        onInsertBelow={vi.fn()}
      />,
    );
    expect(screen.getByTestId('block-handle-grip-b_1')).toBeInTheDocument();
    expect(screen.getByTestId('block-handle-plus-b_1')).toBeInTheDocument();
  });

  it('fires onInsertBelow with the click anchor when the `+` is clicked', () => {
    const onInsertBelow = vi.fn();
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        focused
        onAction={() => {}}
        onInsertBelow={onInsertBelow}
      />,
    );
    fireEvent.click(screen.getByTestId('block-handle-plus-b_1'));
    expect(onInsertBelow).toHaveBeenCalledWith(
      'b_1',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });
});

describe('BlockHandle actions', () => {
  const onAction = vi.fn();

  it('fires duplicate / delete / move-up / move-down', () => {
    render(
      <BlockHandle
        nodeId="b_1"
        label="H2 — Intro"
        focused
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByLabelText('Block actions for H2 — Intro'));
    expect(screen.getByTestId('block-handle-action-duplicate')).toBeInTheDocument();
    expect(screen.getByTestId('block-handle-action-delete')).toBeInTheDocument();
    expect(screen.getByTestId('block-handle-action-move-up')).toBeInTheDocument();
    expect(screen.getByTestId('block-handle-action-move-down')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('block-handle-action-duplicate'));
    expect(onAction).toHaveBeenCalledWith('duplicate', 'b_1');
  });
});

const _typecheck: BlockAction = 'duplicate';
void _typecheck;
