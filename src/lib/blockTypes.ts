import type { BlockType } from '../types';

export interface BlockTypeInfo {
  type: BlockType;
  /** Shown in the slash menu. */
  name: string;
  /** The block's accessible name (what a screen reader announces). */
  label: string;
  /** Extra words the slash menu matches, e.g. "h1" or "todo". */
  aliases: string[];
}

/** Every block type, in slash-menu order. */
export const BLOCK_TYPES: BlockTypeInfo[] = [
  { type: 'p', name: 'Text', label: 'Paragraph', aliases: ['paragraph', 'plain'] },
  { type: 'h1', name: 'Heading 1', label: 'Heading 1', aliases: ['h1', 'title'] },
  { type: 'h2', name: 'Heading 2', label: 'Heading 2', aliases: ['h2'] },
  { type: 'h3', name: 'Heading 3', label: 'Heading 3', aliases: ['h3'] },
  { type: 'bullet', name: 'Bulleted list', label: 'Bulleted list item', aliases: ['bullet', 'ul', 'unordered'] },
  { type: 'number', name: 'Numbered list', label: 'Numbered list item', aliases: ['number', 'ol', 'ordered'] },
  { type: 'todo', name: 'To-do', label: 'To-do', aliases: ['todo', 'task', 'checkbox'] },
  { type: 'quote', name: 'Quote', label: 'Quote', aliases: ['quote', 'blockquote'] },
  { type: 'divider', name: 'Divider', label: 'Divider', aliases: ['divider', 'hr', 'line', 'separator'] },
  { type: 'code', name: 'Code', label: 'Code', aliases: ['code', 'pre'] },
];

export function labelFor(type: BlockType): string {
  return BLOCK_TYPES.find((t) => t.type === type)?.label ?? 'Paragraph';
}

/**
 * Slash-menu filter: the text typed after "/", ignoring case, matched
 * anywhere in the name or at the start of an alias. A query that starts
 * with a space matches nothing, so "/ " closes the menu.
 */
export function filterBlockTypes(query: string): BlockTypeInfo[] {
  if (/^\s/.test(query)) return [];
  const q = query.toLowerCase();
  return BLOCK_TYPES.filter((t) => t.name.toLowerCase().includes(q) || t.aliases.some((a) => a.startsWith(q)));
}
