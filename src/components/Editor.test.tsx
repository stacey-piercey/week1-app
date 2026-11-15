import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Block, BlockType } from '../types';
import Editor from './Editor';

/** A starting block: plain text means a paragraph. */
type Initial = string | [BlockType, string];

/** Holds the blocks in state, the way App does, so edits re-render. */
function Harness({ initial }: { initial: Initial[] }) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initial.map((item, i) => {
      const [type, text] = typeof item === 'string' ? (['p', item] as const) : item;
      return { id: `b${i}`, type, text };
    }),
  );
  return <Editor blocks={blocks} onChange={setBlocks} />;
}

const fields = () => screen.getAllByRole('textbox', { name: 'Paragraph' }) as HTMLTextAreaElement[];
const texts = () => fields().map((f) => f.value);
/** Every text block, in page order, as "label: text". */
const allBlocks = () =>
  (screen.getAllByRole('textbox') as HTMLTextAreaElement[]).map((f) => `${f.getAttribute('aria-label')}: ${f.value}`);
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement;

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

    it('Up and Down skip over a divider', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Above', ['divider', ''], 'Below']} />);

      await user.click(fields()[1]);
      await user.keyboard('{ArrowUp}');
      expect(fields()[0]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(fields()[1]).toHaveFocus();
    });
  });

  describe('markdown shortcuts', () => {
    it.each([
      ['# ', 'Heading 1'],
      ['## ', 'Heading 2'],
      ['### ', 'Heading 3'],
      ['- ', 'Bulleted list item'],
      ['1. ', 'Numbered list item'],
      ['[[] ', 'To-do'], // "[[" types one "[" in user-event
      ['> ', 'Quote'],
      ['```', 'Code'],
    ])('typing "%s" makes a %s, and the next text goes into it', async (keys, label) => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], `${keys}Hello`);

      expect(allBlocks()).toEqual([`${label}: Hello`]);
      expect(field(label)).toHaveFocus();
    });

    it('typing "---" makes a divider with an empty paragraph below, cursor there', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '---After');

      expect(screen.getByRole('separator')).toBeInTheDocument();
      expect(allBlocks()).toEqual(['Paragraph: After']);
    });

    it('a marker typed in front of existing text converts the block and keeps the text', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Title']} />);

      await user.type(fields()[0], '# ', { initialSelectionStart: 0, initialSelectionEnd: 0 });

      expect(allBlocks()).toEqual(['Heading 1: Title']);
    });

    it("doesn't fire in the middle of text", async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], 'a - b');

      expect(allBlocks()).toEqual(['Paragraph: a - b']);
    });
  });

  describe('lists', () => {
    it('Enter in a list item continues the list', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[['bullet', '']]} />);

      await user.type(field('Bulleted list item'), 'Milk{Enter}Eggs');

      expect(allBlocks()).toEqual(['Bulleted list item: Milk', 'Bulleted list item: Eggs']);
    });

    it('Enter on an empty list item turns it into a paragraph', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[['todo', '']]} />);

      await user.type(screen.getByRole('textbox', { name: 'To-do' }), 'Call{Enter}{Enter}Note');

      expect(allBlocks()).toEqual(['To-do: Call', 'Paragraph: Note']);
    });

    it('numbered items count up and restart after another block', async () => {
      render(
        <Harness
          initial={[
            ['number', 'a'],
            ['number', 'b'],
            ['number', 'c'],
            'break',
            ['number', 'd'],
          ]}
        />,
      );

      const markers = [...document.querySelectorAll('.block-marker')].map((m) => m.textContent);
      expect(markers).toEqual(['1.', '2.', '3.', '1.']);
    });

    it('the to-do checkbox ticks and unticks', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[['todo', 'Call']]} />);
      const box = screen.getByRole('checkbox', { name: 'Done' });

      await user.click(box);
      expect(box).toBeChecked();
      await user.click(box);
      expect(box).not.toBeChecked();
    });
  });

  describe('code blocks', () => {
    it('Enter adds a newline instead of a new block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[['code', '']]} />);

      await user.type(field('Code'), 'a{Enter}b');

      expect(allBlocks()).toEqual(['Code: a\nb']);
    });

    it('Ctrl+Enter adds a paragraph below and moves there', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[['code', 'x']]} />);

      await user.type(field('Code'), '{Control>}{Enter}{/Control}After');

      expect(allBlocks()).toEqual(['Code: x', 'Paragraph: After']);
    });
  });

  describe('slash menu', () => {
    const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);

    it('"/" opens a list of every type, and typing filters it', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/');
      expect(screen.getByRole('listbox', { name: 'Block types' })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(10);

      await user.keyboard('head');
      expect(optionNames()).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
      // The textarea points at the highlighted option for screen readers.
      expect(fields()[0]).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);
    });

    it('works with the keyboard alone: arrows move the highlight, Enter picks', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/hea{ArrowDown}');
      expect(screen.getByRole('option', { name: 'Heading 2' })).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{Enter}Title');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(allBlocks()).toEqual(['Heading 2: Title']);
      expect(field('Heading 2')).toHaveFocus();
    });

    it('Up from the first option wraps to the last', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/{ArrowUp}');

      expect(screen.getByRole('option', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
    });

    it('Escape closes it and keeps the typed text', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/hea{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(allBlocks()).toEqual(['Paragraph: /hea']);
      expect(fields()[0]).toHaveFocus();
    });

    it('clicking an option picks it and keeps the focus in the block', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/');
      await user.click(screen.getByRole('option', { name: 'Quote' }));

      expect(allBlocks()).toEqual(['Quote: ']);
      expect(field('Quote')).toHaveFocus();
    });

    it('keeps the rest of the text when picking a type', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Buy milk']} />);

      await user.type(fields()[0], '/todo{Enter}', { initialSelectionStart: 0, initialSelectionEnd: 0 });

      expect(allBlocks()).toEqual(['To-do: Buy milk']);
    });

    it('picking Divider adds a divider and moves to the paragraph below it', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/div{Enter}After');

      expect(screen.getByRole('separator')).toBeInTheDocument();
      expect(allBlocks()).toEqual(['Paragraph: After']);
    });

    it("doesn't open for a slash in the middle of a word", async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], 'and/or');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('opens after a space', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], 'Note /');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes when nothing matches, and Enter then splits as normal', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/zzz');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      await user.keyboard('{Enter}');
      expect(texts()).toEqual(['/zzz', '']);
    });

    it('closes when the slash is deleted', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['']} />);

      await user.type(fields()[0], '/{Backspace}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Backspace on block types', () => {
    it('first turns a formatted block into a paragraph, then merges it', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Hello', ['h2', ' world']]} />);

      await user.type(field('Heading 2'), '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });
      expect(allBlocks()).toEqual(['Paragraph: Hello', 'Paragraph:  world']);
      expect(fields()[1]).toHaveFocus();

      await user.keyboard('{Backspace}');
      expect(allBlocks()).toEqual(['Paragraph: Hello world']);
    });

    it('at the start of the block below a divider removes the divider', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Above', ['divider', ''], 'Below']} />);

      await user.type(fields()[1], '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });

      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      expect(allBlocks()).toEqual(['Paragraph: Above', 'Paragraph: Below']);
      expect(fields()[1]).toHaveFocus();
    });
  });
});
