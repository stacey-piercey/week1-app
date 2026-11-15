import { useCallback, useEffect, useState } from 'react';
import { createPage, deletePage, listPages } from '../lib/storage';
import type { Block, Page } from '../types';

export const SELECTED_PAGE_KEY = 'notes.selectedPageId';

// localStorage can throw (private mode, blocked storage). If it does,
// the selection just isn't remembered.
function readSelectedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PAGE_KEY);
  } catch {
    return null;
  }
}

function saveSelectedId(id: string): void {
  try {
    localStorage.setItem(SELECTED_PAGE_KEY, id);
  } catch {
    // ignore
  }
}

function clearSelectedId(): void {
  try {
    localStorage.removeItem(SELECTED_PAGE_KEY);
  } catch {
    // ignore
  }
}

export function usePages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listPages()
      .then((list) => {
        if (cancelled) return;
        const saved = readSelectedId();
        const initial = list.find((p) => p.id === saved)?.id ?? list[0]?.id ?? null;
        setPages(list);
        setSelectedId(initial);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Could not load pages', error);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectPage = useCallback((id: string) => {
    setSelectedId(id);
    saveSelectedId(id);
  }, []);

  /** Creates a page, appends it, selects it and returns its id. */
  const addPage = useCallback(async () => {
    const page = await createPage();
    setPages((prev) => [...prev, page]);
    selectPage(page.id);
    return page.id;
  }, [selectPage]);

  /** Changes a page's title in memory only. App saves it via useAutosave. */
  const renamePage = useCallback((id: string, title: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
  }, []);

  /** Changes a page's blocks in memory only. App saves them via useAutosave. */
  const setBlocks = useCallback((id: string, blocks: Block[]) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, blocks } : p)));
  }, []);

  /**
   * Deletes a page from storage, then from the list. If it was open, opens
   * `nextId` instead (null = nothing open). Returns false if the delete
   * failed; the page then stays.
   */
  const removePage = useCallback(async (id: string, nextId: string | null) => {
    try {
      await deletePage(id);
    } catch (error) {
      console.error('Could not delete page', error);
      return false;
    }
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((current) => (current === id ? nextId : current));
    if (readSelectedId() === id) {
      if (nextId) saveSelectedId(nextId);
      else clearSelectedId();
    }
    return true;
  }, []);

  return { pages, selectedId, loading, addPage, selectPage, renamePage, setBlocks, removePage };
}
