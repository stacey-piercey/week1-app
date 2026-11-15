import { describe, expect, it } from 'vitest';
import type { Page } from '../types';
import { displayTitle, filterPages } from './search';

function page(title: string): Page {
  return { id: title || 'empty', title, order: 0, createdAt: 0, updatedAt: 0, blocks: [] };
}

const pages = [page('Groceries'), page('Meeting notes'), page('Ideas'), page('')];
const titles = (list: Page[]) => list.map((p) => p.title);

describe('filterPages', () => {
  it('ignores case', () => {
    expect(titles(filterPages(pages, 'GRO'))).toEqual(['Groceries']);
  });

  it('matches part of a title', () => {
    expect(titles(filterPages(pages, 'notes'))).toEqual(['Meeting notes']);
  });

  it('ignores spaces around the query', () => {
    expect(titles(filterPages(pages, '  ideas  '))).toEqual(['Ideas']);
  });

  it('keeps every page for an empty or blank query', () => {
    expect(filterPages(pages, '')).toEqual(pages);
    expect(filterPages(pages, '   ')).toEqual(pages);
  });

  it('finds untitled pages by the name the sidebar shows', () => {
    expect(titles(filterPages(pages, 'untitled'))).toEqual(['']);
  });

  it('returns nothing when no title matches', () => {
    expect(filterPages(pages, 'zzz')).toEqual([]);
  });
});

describe('displayTitle', () => {
  it('shows "Untitled" for empty or blank titles', () => {
    expect(displayTitle('')).toBe('Untitled');
    expect(displayTitle('  ')).toBe('Untitled');
    expect(displayTitle('Ideas')).toBe('Ideas');
  });
});
