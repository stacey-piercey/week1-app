import { useEffect, useRef, useState } from 'react';
import { displayTitle } from '../lib/search';
import type { Page } from '../types';
import ConfirmDialog from './ConfirmDialog';
import PageListItem from './PageListItem';

interface SidebarProps {
  pages: Page[];
  selectedId: string | null;
  loading?: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
  /** Delete a page. `nextId` is the page to open if the deleted one was open. */
  onDelete: (id: string, nextId: string | null) => void | Promise<void>;
}

/** Where focus goes once the list has re-rendered. */
type FocusTarget =
  | { kind: 'row'; id: string } // a page's name button
  | { kind: 'trash'; id: string } // a page's trash button
  | { kind: 'new' }; // "+ New page"

/** The page below `id` in `list`, else the one above, else null. */
function neighbourId(list: Page[], id: string): string | null {
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;
  return list[index + 1]?.id ?? list[index - 1]?.id ?? null;
}

export default function Sidebar({
  pages,
  selectedId,
  loading = false,
  onAdd,
  onSelect,
  onDelete,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const newPageRef = useRef<HTMLButtonElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  // Move focus after the render that follows a delete or a cancel.
  useEffect(() => {
    if (!focusTarget) return;
    setFocusTarget(null);
    if (focusTarget.kind === 'new') {
      newPageRef.current?.focus();
      return;
    }
    const selector = focusTarget.kind === 'row' ? '.page-item' : '.page-delete';
    const el = sidebarRef.current?.querySelector<HTMLElement>(
      `[data-page-id="${focusTarget.id}"] ${selector}`,
    );
    (el ?? newPageRef.current)?.focus();
  }, [focusTarget]);

  const cancelDelete = () => {
    if (pendingDelete) setFocusTarget({ kind: 'trash', id: pendingDelete.id });
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    const page = pendingDelete;
    if (!page) return;
    setPendingDelete(null);
    const nextId = neighbourId(pages, page.id);
    await onDelete(page.id, nextId);
    setFocusTarget(nextId ? { kind: 'row', id: nextId } : { kind: 'new' });
  };

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="app-name">Notes</div>
      <button ref={newPageRef} type="button" className="new-page" onClick={() => onAdd()}>
        <span aria-hidden="true">+</span> New page
      </button>
      <nav aria-label="Pages">
        {loading ? null : pages.length === 0 ? (
          <p className="sidebar-empty">No pages yet</p>
        ) : (
          <ul className="page-list">
            {pages.map((page) => (
              <li key={page.id}>
                <PageListItem
                  page={page}
                  selected={page.id === selectedId}
                  onSelect={onSelect}
                  onDelete={setPendingDelete}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${displayTitle(pendingDelete.title)}"?`}
          message="This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}
    </aside>
  );
}
