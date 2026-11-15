import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Block } from '../types';
import Editor from './Editor';

/** Holds the blocks in state, the way App does, so edits re-render. */
function Harness({ initial }: { initial: string[] }) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initial.map((text, i) => ({ id: `b${i}`, type: 'p', text })),
  );
  return <Editor blocks={blocks} onChange={setBlocks} />;
}

const fields = () => screen.getAllByRole('textbox', { name: 'Paragraph' }) as HTMLTextAreaElement[];
const texts = () => fields().map((f) => f.value);

// These tests check the cursor *logic*. jsdom has no layout, so text never
// wraps here: wrapped-text Up/Down is in PLAN.md's manual checklist instead.
describe('Editor', () => {
  it('typing changes the block text', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['']} />);
    await user.type(fields()[0], 'Hello');
    expect(texts()).toEqual(['Hello']);
  });

  describe('Enter', () => {
    it('splits the block at the cursor and puts the cursor at the start of the new block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Hello world']} />);

      await user.type(fields()[0], '{Enter}', { initialSelectionStart: 5, initialSelectionEnd: 5 });

      expect(texts()).toEqual(['Hello', ' world']);
      expect(fields()[1]).toHaveFocus();
      expect(fields()[1].selectionStart).toBe(0);
    });

    it('at the end adds an empty block below, and typing goes into it', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['One', 'Three']} />);

      await user.type(fields()[0], '{Enter}Two');

      expect(texts()).toEqual(['One', 'Two', 'Three']);
    });

    it('with text selected, replaces the selection and splits there', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Hello big world']} />);

      await user.type(fields()[0], '{Enter}', { initialSelectionStart: 5, initialSelectionEnd: 9 });

      expect(texts()).toEqual(['Hello', ' world']);
    });

    it('Shift+Enter adds a line break inside the block instead of splitting', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['AB']} />);

      await user.type(fields()[0], '{Shift>}{Enter}{/Shift}', { initialSelectionStart: 1, initialSelectionEnd: 1 });

      expect(texts()).toEqual(['A\nB']);
    });
  });

  describe('Backspace', () => {
    it('at the start of a block merges it into the block above, cursor at the join', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Hello', ' world']} />);

      await user.type(fields()[1], '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });

      expect(texts()).toEqual(['Hello world']);
      expect(fields()[0]).toHaveFocus();
      expect(fields()[0].selectionStart).toBe(5);
    });

    it('in the middle of text deletes one character and does not merge', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Hello', 'world']} />);

      await user.type(fields()[1], '{Backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 });

      expect(texts()).toEqual(['Hello', 'wold']);
    });

    it('in an empty first block removes it and moves to the next block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['', 'Next']} />);

      await user.type(fields()[0], '{Backspace}');

      expect(texts()).toEqual(['Next']);
      expect(fields()[0]).toHaveFocus();
      expect(fields()[0].selectionStart).toBe(0);
    });

    it('never deletes the last block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '{Backspace}{Backspace}');

      expect(texts()).toEqual(['']);
      expect(fields()[0]).toHaveFocus();
    });
  });

  describe('Up and Down (single-line text)', () => {
    it('Up moves to the block above, Down moves back', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['First', 'Second']} />);

      await user.click(fields()[1]);
      await user.keyboard('{ArrowUp}');
      expect(fields()[0]).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(fields()[1]).toHaveFocus();
    });

    it('Up in the first block and Down in the last block stay put', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Only']} />);

      await user.click(fields()[0]);
      await user.keyboard('{ArrowUp}');
      expect(fields()[0]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(fields()[0]).toHaveFocus();
    });

    it('Shift+Up selects text instead of leaving the block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['First', 'Second']} />);

      await user.click(fields()[1]);
      await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
      expect(fields()[1]).toHaveFocus();
    });
  });
});
