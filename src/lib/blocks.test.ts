import { describe, expect, it } from 'vitest';
import type { Block, BlockType } from '../types';
import {
  applyShortcut,
  applySlashChoice,
  backspaceAtStart,
  changeType,
  deleteEmptyBlock,
  detectShortcut,
  insertParagraphAfter,
  listNumbers,
  mergeWithPrevious,
  setBlockText,
  splitBlock,
  toggleChecked,
} from './blocks';

const p = (id: string, text: string): Block => ({ id, type: 'p', text });
const b = (id: string, type: BlockType, text = ''): Block => ({ id, type, text });
const hr = (id: string): Block => ({ id, type: 'divider', text: '' });
const texts = (blocks: Block[]) => blocks.map((b) => b.text);
const types = (blocks: Block[]) => blocks.map((b) => b.type);

describe('splitBlock', () => {
  it('splits at the cursor and puts the cursor at the start of the new block', () => {
    const result = splitBlock([p('a', 'Hello world')], 'a', 5)!;
    expect(texts(result.blocks)).toEqual(['Hello', ' world']);
    expect(result.blocks[0].id).toBe('a');
    expect(result.blocks[1].id).not.toBe('a');
    expect(result.blocks[1].type).toBe('p');
    expect(result.cursor).toEqual({ id: result.blocks[1].id, offset: 0 });
  });

  it('at the end of the text adds an empty block below', () => {
    const result = splitBlock([p('a', 'Hello')], 'a', 5)!;
    expect(texts(result.blocks)).toEqual(['Hello', '']);
  });

  it('at the start of the text pushes all of it down', () => {
    const result = splitBlock([p('a', 'Hello')], 'a', 0)!;
    expect(texts(result.blocks)).toEqual(['', 'Hello']);
  });

  it('removes selected text before splitting', () => {
    const result = splitBlock([p('a', 'Hello big world')], 'a', 5, 9)!;
    expect(texts(result.blocks)).toEqual(['Hello', ' world']);
  });

  it('inserts the new block right below, keeping the others in order', () => {
    const result = splitBlock([p('a', 'One'), p('b', 'Two'), p('c', 'Three')], 'b', 2)!;
    expect(texts(result.blocks)).toEqual(['One', 'Tw', 'o', 'Three']);
  });

  it('returns null for an unknown block', () => {
    expect(splitBlock([p('a', 'x')], 'nope', 0)).toBeNull();
  });

  it('after a heading or quote, the new block is a paragraph', () => {
    expect(splitBlock([b('a', 'h1', 'Title')], 'a', 5)!.blocks[1].type).toBe('p');
    expect(splitBlock([b('a', 'quote', 'Said')], 'a', 4)!.blocks[1].type).toBe('p');
  });

  it.each(['bullet', 'number', 'todo'] as BlockType[])('a %s item continues the list', (type) => {
    const result = splitBlock([b('a', type, 'One')], 'a', 3)!;
    expect(types(result.blocks)).toEqual([type, type]);
  });

  it('a new to-do starts unchecked, even after a checked one', () => {
    const result = splitBlock([{ id: 'a', type: 'todo', text: 'Done', checked: true }], 'a', 4)!;
    expect(result.blocks[0].checked).toBe(true);
    expect(result.blocks[1].checked).toBe(false);
  });

  it('on an empty list item, turns it into a paragraph instead of adding a block', () => {
    const result = splitBlock([b('a', 'bullet', 'One'), b('c', 'bullet')], 'c', 0)!;
    expect(types(result.blocks)).toEqual(['bullet', 'p']);
    expect(result.cursor).toEqual({ id: 'c', offset: 0 });
  });

  it('at the start of a heading, adds an empty paragraph above and the heading keeps its type', () => {
    const result = splitBlock([b('a', 'h2', 'Title')], 'a', 0)!;
    expect(types(result.blocks)).toEqual(['p', 'h2']);
    expect(texts(result.blocks)).toEqual(['', 'Title']);
    expect(result.cursor).toEqual({ id: 'a', offset: 0 });
  });
});

describe('mergeWithPrevious', () => {
  it('joins the text onto the block above, with the cursor at the join', () => {
    const result = mergeWithPrevious([p('a', 'Hello'), p('b', ' world')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hello world']);
    expect(result.blocks[0].id).toBe('a');
    expect(result.cursor).toEqual({ id: 'a', offset: 5 });
  });

  it('merging an empty block removes it, with the cursor at the end of the block above', () => {
    const result = mergeWithPrevious([p('a', 'Hello'), p('b', ''), p('c', 'After')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hello', 'After']);
    expect(result.cursor).toEqual({ id: 'a', offset: 5 });
  });

  it('returns null for the first block', () => {
    expect(mergeWithPrevious([p('a', 'Hello'), p('b', 'x')], 'a')).toBeNull();
  });
});

describe('deleteEmptyBlock', () => {
  it('removes an empty block and moves the cursor to the end of the block above', () => {
    const result = deleteEmptyBlock([p('a', 'Hi'), p('b', '')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hi']);
    expect(result.cursor).toEqual({ id: 'a', offset: 2 });
  });

  it('removing an empty first block moves the cursor to the start of the next one', () => {
    const result = deleteEmptyBlock([p('a', ''), p('b', 'Next')], 'a')!;
    expect(texts(result.blocks)).toEqual(['Next']);
    expect(result.cursor).toEqual({ id: 'b', offset: 0 });
  });

  it('never deletes the last block', () => {
    expect(deleteEmptyBlock([p('a', '')], 'a')).toBeNull();
  });

  it("doesn't delete a block that has text", () => {
    expect(deleteEmptyBlock([p('a', 'x'), p('b', 'y')], 'b')).toBeNull();
  });

  it('never puts the cursor on a divider', () => {
    const result = deleteEmptyBlock([p('a', ''), hr('d'), p('c', 'After')], 'a')!;
    expect(result.cursor).toEqual({ id: 'c', offset: 0 });
  });
});

describe('backspaceAtStart', () => {
  it('turns a formatted block into a paragraph and keeps the text', () => {
    const result = backspaceAtStart([p('a', 'Above'), b('b', 'h1', 'Title')], 'b')!;
    expect(types(result.blocks)).toEqual(['p', 'p']);
    expect(texts(result.blocks)).toEqual(['Above', 'Title']);
    expect(result.cursor).toEqual({ id: 'b', offset: 0 });
  });

  it('in a paragraph below a divider, removes the divider', () => {
    const result = backspaceAtStart([p('a', 'Above'), hr('d'), p('b', 'Below')], 'b')!;
    expect(types(result.blocks)).toEqual(['p', 'p']);
    expect(texts(result.blocks)).toEqual(['Above', 'Below']);
    expect(result.cursor).toEqual({ id: 'b', offset: 0 });
  });

  it('in a paragraph, merges into the block above', () => {
    const result = backspaceAtStart([p('a', 'Hello'), p('b', ' world')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hello world']);
  });

  it('in an empty first paragraph, deletes it', () => {
    const result = backspaceAtStart([p('a', ''), p('b', 'Next')], 'a')!;
    expect(texts(result.blocks)).toEqual(['Next']);
  });

  it('does nothing in the only paragraph', () => {
    expect(backspaceAtStart([p('a', '')], 'a')).toBeNull();
  });
});

describe('changeType', () => {
  it('keeps the id and the text', () => {
    const result = changeType([p('a', 'Keep me')], 'a', 'quote')!;
    expect(result.blocks).toEqual([{ id: 'a', type: 'quote', text: 'Keep me' }]);
  });

  it('a new to-do is unchecked; other types drop "checked"', () => {
    expect(changeType([p('a', 'x')], 'a', 'todo')!.blocks[0].checked).toBe(false);
    const fromTodo = changeType([{ id: 'a', type: 'todo', text: 'x', checked: true }], 'a', 'p')!;
    expect(fromTodo.blocks[0]).not.toHaveProperty('checked');
  });

  it('an empty block becomes a divider with an empty paragraph below, cursor there', () => {
    const result = changeType([p('a', '')], 'a', 'divider')!;
    expect(types(result.blocks)).toEqual(['divider', 'p']);
    expect(result.blocks[0].id).toBe('a');
    expect(result.cursor).toEqual({ id: result.blocks[1].id, offset: 0 });
  });

  it('a block with text keeps it; the divider and an empty paragraph go below', () => {
    const result = changeType([p('a', 'Text'), p('z', 'Last')], 'a', 'divider')!;
    expect(types(result.blocks)).toEqual(['p', 'divider', 'p', 'p']);
    expect(texts(result.blocks)).toEqual(['Text', '', '', 'Last']);
    expect(result.cursor.id).toBe(result.blocks[2].id);
  });
});

describe('detectShortcut', () => {
  it.each([
    ['# ', 'h1'],
    ['## ', 'h2'],
    ['### ', 'h3'],
    ['- ', 'bullet'],
    ['1. ', 'number'],
    ['[] ', 'todo'],
    ['> ', 'quote'],
    ['---', 'divider'],
    ['```', 'code'],
  ])('"%s" makes a %s block', (marker, type) => {
    expect(detectShortcut(marker, marker.length)).toEqual({ type, text: '' });
  });

  it('keeps the text after the marker', () => {
    // Typing "# " in front of existing text.
    expect(detectShortcut('# Hello', 2)).toEqual({ type: 'h1', text: 'Hello' });
  });

  it("doesn't fire when the cursor isn't right after the marker (e.g. pasted text)", () => {
    expect(detectShortcut('# Hello', 7)).toBeNull();
  });

  it("doesn't fire in the middle of text", () => {
    expect(detectShortcut('a # ', 4)).toBeNull();
    expect(detectShortcut('a---', 4)).toBeNull();
  });

  it('divider and code need the marker to be the whole text', () => {
    expect(detectShortcut('---x', 3)).toBeNull();
    expect(detectShortcut('```js', 3)).toBeNull();
  });
});

describe('applyShortcut', () => {
  it('converts a paragraph and removes the marker', () => {
    const result = applyShortcut([p('a', '')], 'a', '- Milk', 2)!;
    expect(result.blocks).toEqual([{ id: 'a', type: 'bullet', text: 'Milk' }]);
    expect(result.cursor).toEqual({ id: 'a', offset: 0 });
  });

  it("doesn't convert blocks that aren't paragraphs", () => {
    expect(applyShortcut([b('a', 'h1')], 'a', '- ', 2)).toBeNull();
  });
});

describe('applySlashChoice', () => {
  it('removes "/query", changes the type and keeps the rest of the text', () => {
    // "Buy /tod milk": the slash is at 4, the query ends at 8.
    const result = applySlashChoice([p('a', 'Buy /tod milk')], 'a', 4, 8, 'todo')!;
    expect(result.blocks[0]).toMatchObject({ type: 'todo', text: 'Buy  milk' });
    expect(result.cursor).toEqual({ id: 'a', offset: 4 });
  });
});

describe('insertParagraphAfter', () => {
  it('adds an empty paragraph right below, with the cursor in it', () => {
    const result = insertParagraphAfter([b('a', 'code', 'x'), p('z', 'Last')], 'a')!;
    expect(types(result.blocks)).toEqual(['code', 'p', 'p']);
    expect(texts(result.blocks)).toEqual(['x', '', 'Last']);
    expect(result.cursor).toEqual({ id: result.blocks[1].id, offset: 0 });
  });
});

describe('toggleChecked', () => {
  it('ticks and unticks one to-do', () => {
    const once = toggleChecked([b('a', 'todo'), b('b', 'todo')], 'a');
    expect(once.map((x) => !!x.checked)).toEqual([true, false]);
    expect(toggleChecked(once, 'a')[0].checked).toBe(false);
  });
});

describe('listNumbers', () => {
  it('counts up within a run and restarts after any other block', () => {
    const numbers = listNumbers([
      b('a', 'number'),
      b('b', 'number'),
      b('c', 'number'),
      p('x', 'break'),
      b('d', 'number'),
    ]);
    expect([...numbers.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 1],
    ]);
  });
});

describe('setBlockText', () => {
  it('changes only the matching block', () => {
    const blocks = [p('a', 'One'), p('b', 'Two')];
    expect(texts(setBlockText(blocks, 'b', 'Changed'))).toEqual(['One', 'Changed']);
    expect(texts(blocks)).toEqual(['One', 'Two']); // original untouched
  });
});
