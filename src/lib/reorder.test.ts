import { describe, expect, it } from 'vitest';
import type { Page } from '../types';
import { movePage } from './reorder';

function page(id: string, order: number): Page {
  return { id, title: id, order, createdAt: 0, updatedAt: 0, blocks: [] };
}

const pages = [page('a', 0), page('b', 1), page('c', 2), page('d', 3)];
const ids = (list: Page[]) => list.map((p) => p.id);
const orders = (list: Page[]) => list.map((p) => p.order);

describe('movePage', () => {
  it('moves a page down', () => {
    const result = movePage(pages, 'a', 'c');
    expect(ids(result)).toEqual(['b', 'c', 'a', 'd']);
    expect(orders(result)).toEqual([0, 1, 2, 3]);
  });

  it('moves a page up', () => {
    const result = movePage(pages, 'd', 'b');
    expect(ids(result)).toEqual(['a', 'd', 'b', 'c']);
    expect(orders(result)).toEqual([0, 1, 2, 3]);
  });

  it('moves a page to the first and last place', () => {
    expect(ids(movePage(pages, 'c', 'a'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(movePage(pages, 'b', 'd'))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('renumbers order from 0 even when the old numbers had gaps', () => {
    const gappy = [page('a', 0), page('b', 5), page('c', 9)];
    expect(orders(movePage(gappy, 'c', 'a'))).toEqual([0, 1, 2]);
  });

  it('changes nothing when a page is dropped on itself', () => {
    expect(movePage(pages, 'b', 'b')).toBe(pages);
  });

  it('changes nothing when an id is unknown', () => {
    expect(movePage(pages, 'x', 'b')).toBe(pages);
    expect(movePage(pages, 'a', 'x')).toBe(pages);
  });

  it('does not change the original list', () => {
    movePage(pages, 'a', 'd');
    expect(ids(pages)).toEqual(['a', 'b', 'c', 'd']);
    expect(orders(pages)).toEqual([0, 1, 2, 3]);
  });
});
