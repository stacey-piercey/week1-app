import type { Page } from '../types';

/** The name the sidebar shows for a page. Empty titles read as "Untitled". */
export function displayTitle(title: string): string {
  return title.trim() === '' ? 'Untitled' : title;
}

/**
 * Pages whose shown title contains `query`: case-insensitive, any part of
 * the title, spaces around the query ignored. An empty query keeps all pages.
 */
export function filterPages(pages: Page[], query: string): Page[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return pages;
  return pages.filter((p) => displayTitle(p.title).toLowerCase().includes(needle));
}
