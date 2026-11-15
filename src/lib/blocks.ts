import type { Block } from '../types';

/** Where the cursor should go after an edit: which block, and at which character. */
export interface CursorTarget {
  id: string;
  offset: number;
}

export interface EditResult {
  blocks: Block[];
  cursor: CursorTarget;
}

export function newParagraph(text = ''): Block {
  return { id: crypto.randomUUID(), type: 'p', text };
}

/**
 * Enter: split a block at the cursor. Text before the cursor stays, text
 * after it moves to a new paragraph below. If text is selected
 * (start < end), the selection is removed first, as in any text editor.
 */
export function splitBlock(blocks: Block[], id: string, start: number, end = start): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const block = blocks[index];
  const before: Block = { ...block, text: block.text.slice(0, start) };
  const after = newParagraph(block.text.slice(end));
  return {
    blocks: [...blocks.slice(0, index), before, after, ...blocks.slice(index + 1)],
    cursor: { id: after.id, offset: 0 },
  };
}

/**
 * Backspace at the start of a block: join its text onto the end of the
 * block above. The cursor goes to the join point. Returns null for the
 * first block (there's nothing above to merge into).
 */
export function mergeWithPrevious(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index <= 0) return null;
  const previous = blocks[index - 1];
  const merged: Block = { ...previous, text: previous.text + blocks[index].text };
  return {
    blocks: [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)],
    cursor: { id: previous.id, offset: previous.text.length },
  };
}

/**
 * Remove an empty block and put the cursor in a neighbour (the block above,
 * or the one below if it was first). Returns null if the block has text or
 * is the only block left: a page always keeps at least one block.
 */
export function deleteEmptyBlock(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1 || blocks.length <= 1 || blocks[index].text !== '') return null;
  const remaining = blocks.filter((b) => b.id !== id);
  const cursor =
    index > 0
      ? { id: blocks[index - 1].id, offset: blocks[index - 1].text.length }
      : { id: blocks[index + 1].id, offset: 0 };
  return { blocks: remaining, cursor };
}

/** Change one block's text, leaving the others as they are. */
export function setBlockText(blocks: Block[], id: string, text: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b));
}
