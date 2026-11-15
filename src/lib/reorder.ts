import { arrayMove } from '@dnd-kit/sortable';
import type { Page } from '../types';

/**
 * Moves page `activeId` to where page `overId` is, then numbers every
 * page's `order` 0, 1, 2… in the new sequence. Returns the same list
 * (unchanged) if either id is missing or they're the same page.
 */
export function movePage(pages: Page[], activeId: string, overId: string): Page[] {
  const from = pages.findIndex((p) => p.id === activeId);
  const to = pages.findIndex((p) => p.id === overId);
  if (from === -1 || to === -1 || from === to) return pages;
  return arrayMove(pages, from, to).map((p, index) => (p.order === index ? p : { ...p, order: index }));
}
