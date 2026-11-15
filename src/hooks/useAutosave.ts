import { useCallback, useEffect, useRef, useState } from 'react';
import { updatePage } from '../lib/storage';
import type { Page } from '../types';

export const AUTOSAVE_DELAY_MS = 500;

export type PageChanges = Partial<Pick<Page, 'title' | 'blocks'>>;
export type SaveFn = (pageId: string, changes: PageChanges) => Promise<unknown>;
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave. Edits are collected per page and saved 500 ms after
 * the last one. They're saved at once when the tab is hidden or closing,
 * when `flush()` is called (e.g. on page switch), or on unmount.
 * Saves run one at a time, in order, so an older save never lands last.
 */
export function useAutosave(save: SaveFn = updatePage) {
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Unsaved edits, keyed by page id.
  const pending = useRef(new Map<string, PageChanges>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The save queue: each batch waits for the one before it.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Bumped by clearStatus(). A save started before a clear doesn't show
  // "Saved" afterwards (e.g. page A's save finishing after you open page B).
  const statusGeneration = useRef(0);

  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback((): Promise<void> => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current.size === 0) return queue.current;

    const batch = [...pending.current];
    pending.current.clear();
    setStatus('saving');
    const generation = statusGeneration.current;

    queue.current = queue.current.then(async () => {
      let failed = false;
      for (const [pageId, changes] of batch) {
        try {
          await saveRef.current(pageId, changes);
        } catch (error) {
          console.error('Autosave failed', error);
          failed = true;
          // Keep the edit for a retry. Anything typed since then is newer, so it wins.
          pending.current.set(pageId, { ...changes, ...pending.current.get(pageId) });
        }
      }
      // A failure always shows, even after a clear, so it's never hidden.
      if (failed) setStatus('error');
      else if (pending.current.size === 0 && generation === statusGeneration.current) {
        setStatus('saved');
      }
    });
    return queue.current;
  }, []);

  /** Hide the status (e.g. when another page opens). Saving carries on. */
  const clearStatus = useCallback(() => {
    statusGeneration.current += 1;
    setStatus('idle');
  }, []);

  /**
   * Drop a page's unsaved edit (e.g. the page is being deleted), so it's
   * never saved. A save already running carries on: wait for `flush()`.
   */
  const discard = useCallback((pageId: string) => {
    pending.current.delete(pageId);
    if (pending.current.size === 0 && timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(
    (pageId: string, changes: PageChanges) => {
      pending.current.set(pageId, { ...pending.current.get(pageId), ...changes });
      setStatus('saving');
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Save straight away when the tab is hidden or the page is closing.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onLeave = () => void flush();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush]);

  return { status, schedule, flush, clearStatus, discard };
}
