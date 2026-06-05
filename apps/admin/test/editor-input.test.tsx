import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from '../src/components/Editor/index.tsx';

describe('Editor content input', () => {
  it('emits updated paragraph content from contentEditable blocks', () => {
    const onChange = vi.fn();
    const { container } = render(<Editor value="Initial paragraph" onChange={onChange} />);

    const paragraph = container.querySelector('[contenteditable="true"]');
    expect(paragraph).not.toBeNull();
    if (!paragraph) throw new Error('paragraph not found');
    paragraph.textContent = 'Persisted paragraph';
    fireEvent.input(paragraph);

    expect(onChange).toHaveBeenLastCalledWith('Persisted paragraph');
  });
});
