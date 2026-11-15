import type { Block, BlockType } from '../types';

/** Where the cursor should go after an edit: which block, and at which character. */
export interface CursorTarget {
  id: string;
  offset: number;
}

export interface EditResult {
  blocks: Block[];
  cursor: CursorTarget;
}

/** List types: Enter continues the list, Enter on an empty item ends it. */
const LIST_TYPES: BlockType[] = ['bullet', 'number', 'todo'];
export const isListType = (type: BlockType) => LIST_TYPES.includes(type);

/** Every block except a divider holds text and can take the cursor. */
export const isTextBlock = (block: Block) => block.type !== 'divider';

export function newBlock(type: BlockType = 'p', text = ''): Block {
  const block: Block = { id: crypto.randomUUID(), type, text };
  if (type === 'todo') block.checked = false;
  return block;
}

export function newParagraph(text = ''): Block {
  return newBlock('p', text);
}

/**
 * Enter: split a block at the cursor. Text before the cursor stays, text
 * after it moves to a new block below. If text is selected (start < end),
 * the selection is removed first, as in any text editor.
 *
 * - The new block is a paragraph, except in lists, where it continues the
 *   list (a new to-do starts unchecked).
 * - Enter on an empty list item turns it into a paragraph instead.
 * - Enter at the very start of a block with text adds an empty paragraph
 *   above, and the block keeps its type.
 */
export function splitBlock(blocks: Block[], id: string, start: number, end = start): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const block = blocks[index];

  if (isListType(block.type) && block.text === '') {
    return changeType(blocks, id, 'p');
  }

  if (end === 0 && block.text !== '') {
    return {
      blocks: [...blocks.slice(0, index), newParagraph(), ...blocks.slice(index)],
      cursor: { id, offset: 0 },
    };
  }

  const before: Block = { ...block, text: block.text.slice(0, start) };
  const rest = block.text.slice(end);
  const after = isListType(block.type) ? newBlock(block.type, rest) : newParagraph(rest);
  return {
    blocks: [...blocks.slice(0, index), before, after, ...blocks.slice(index + 1)],
    cursor: { id: after.id, offset: 0 },
  };
}

/**
 * Backspace at the start of a block: join its text onto the end of the
 * block above. The cursor goes to the join point. Returns null for the
 * first block (there's nothing above to merge into) or when the block
 * above is a divider.
 */
export function mergeWithPrevious(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index <= 0) return null;
  const previous = blocks[index - 1];
  if (!isTextBlock(previous)) return null;
  const merged: Block = { ...previous, text: previous.text + blocks[index].text };
  return {
    blocks: [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)],
    cursor: { id: previous.id, offset: previous.text.length },
  };
}

/**
 * Remove an empty block and put the cursor in the nearest text block (above
 * if there is one, otherwise below). Returns null if the block has text or
 * no other text block would be left: a page always keeps one to type in.
 */
export function deleteEmptyBlock(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1 || blocks[index].text !== '') return null;
  const above = blocks.slice(0, index).reverse().find(isTextBlock);
  const below = blocks.slice(index + 1).find(isTextBlock);
  const cursor = above
    ? { id: above.id, offset: above.text.length }
    : below
      ? { id: below.id, offset: 0 }
      : null;
  if (!cursor) return null;
  return { blocks: blocks.filter((b) => b.id !== id), cursor };
}

/**
 * Backspace with the cursor at the very start of a block, in this order:
 * 1. A heading, list item, to-do, quote or code block becomes a paragraph.
 * 2. A paragraph just below a divider removes the divider.
 * 3. A paragraph merges into the block above.
 * 4. An empty first paragraph is deleted.
 */
export function backspaceAtStart(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const block = blocks[index];
  if (block.type !== 'p') return changeType(blocks, id, 'p');

  const previous = blocks[index - 1];
  if (previous && !isTextBlock(previous)) {
    return { blocks: blocks.filter((b) => b.id !== previous.id), cursor: { id, offset: 0 } };
  }
  return mergeWithPrevious(blocks, id) ?? deleteEmptyBlock(blocks, id);
}

/**
 * Change a block's type and keep its text. The cursor goes to `offset` in
 * the same block.
 *
 * A divider holds no text, so turning a block into one works differently:
 * an empty block becomes the divider; a block with text stays as it is and
 * the divider goes below it. Either way an empty paragraph follows the
 * divider, with the cursor in it.
 */
export function changeType(blocks: Block[], id: string, type: BlockType, offset = 0): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const block = blocks[index];

  if (type === 'divider') {
    const paragraph = newParagraph();
    const replaced =
      block.text === ''
        ? [{ id: block.id, type: 'divider' as const, text: '' }]
        : [block, newBlock('divider')];
    return {
      blocks: [...blocks.slice(0, index), ...replaced, paragraph, ...blocks.slice(index + 1)],
      cursor: { id: paragraph.id, offset: 0 },
    };
  }

  const changed: Block = { id: block.id, type, text: block.text };
  if (type === 'todo') changed.checked = block.checked ?? false;
  return {
    blocks: blocks.map((b) => (b.id === id ? changed : b)),
    cursor: { id, offset: Math.min(offset, block.text.length) },
  };
}

// Markdown shortcuts. Prefix ones fire as soon as the space is typed; the
// whole-text ones fire when the last character of the marker is typed.
const PREFIX_SHORTCUTS: [string, BlockType][] = [
  ['# ', 'h1'],
  ['## ', 'h2'],
  ['### ', 'h3'],
  ['- ', 'bullet'],
  ['1. ', 'number'],
  ['[] ', 'todo'],
  ['> ', 'quote'],
];
const WHOLE_TEXT_SHORTCUTS: [string, BlockType][] = [
  ['---', 'divider'],
  ['```', 'code'],
];

/**
 * Does this text start with a markdown shortcut that was just typed? Only
 * when the cursor sits right after the marker, so pasting "# Title" (cursor
 * at the end) doesn't convert. Returns the new type and the text without
 * the marker.
 */
export function detectShortcut(text: string, caret: number): { type: BlockType; text: string } | null {
  for (const [marker, type] of WHOLE_TEXT_SHORTCUTS) {
    if (text === marker && caret === marker.length) return { type, text: '' };
  }
  for (const [marker, type] of PREFIX_SHORTCUTS) {
    if (text.startsWith(marker) && caret === marker.length) return { type, text: text.slice(marker.length) };
  }
  return null;
}

/**
 * New text typed into a block: if it's a markdown shortcut in a paragraph,
 * convert the block. Returns null when there's no shortcut to apply.
 */
export function applyShortcut(blocks: Block[], id: string, text: string, caret: number): EditResult | null {
  const block = blocks.find((b) => b.id === id);
  if (!block || block.type !== 'p') return null;
  const match = detectShortcut(text, caret);
  if (!match) return null;
  return changeType(setBlockText(blocks, id, match.text), id, match.type);
}

/**
 * A slash-menu choice: remove the "/query" text (characters from..to) and
 * change the block's type. The cursor goes where the slash was.
 */
export function applySlashChoice(blocks: Block[], id: string, from: number, to: number, type: BlockType): EditResult | null {
  const block = blocks.find((b) => b.id === id);
  if (!block) return null;
  const text = block.text.slice(0, from) + block.text.slice(to);
  return changeType(setBlockText(blocks, id, text), id, type, from);
}

/** Ctrl+Enter in a code block: add an empty paragraph below and move there. */
export function insertParagraphAfter(blocks: Block[], id: string): EditResult | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const paragraph = newParagraph();
  return {
    blocks: [...blocks.slice(0, index + 1), paragraph, ...blocks.slice(index + 1)],
    cursor: { id: paragraph.id, offset: 0 },
  };
}

/** Tick or untick a to-do. */
export function toggleChecked(blocks: Block[], id: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
}

/**
 * The number shown in front of each numbered-list block: 1, 2, 3… within
 * each unbroken run of numbered blocks, restarting after any other block.
 */
export function listNumbers(blocks: Block[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let count = 0;
  for (const block of blocks) {
    count = block.type === 'number' ? count + 1 : 0;
    if (count > 0) numbers.set(block.id, count);
  }
  return numbers;
}

/** Change one block's text, leaving the others as they are. */
export function setBlockText(blocks: Block[], id: string, text: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b));
}
