import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEffect, useRef, useState } from 'react';
import { displayTitle, filterPages } from '../lib/search';
import type { Page } from '../types';
import ConfirmDialog from './ConfirmDialog';
import PageListItem from './PageListItem';
import SearchBox from './SearchBox';

interface SidebarProps {
  pages: Page[];
  selectedId: string | null;
  loading?: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
  /** Delete a page. `nextId` is the page to open if the deleted one was open. */
  onDelete: (id: string, nextId: string | null) => void | Promise<void>;
  /** Move page `activeId` to where page `overId` is. */
  onReorder?: (activeId: string, overId: string) => unknown;
}

const dragInstructions =
  'To reorder, press Space to pick up the page. Use the Up and Down arrow keys to move it, ' +
  'then Space to drop it, or Escape to cancel.';

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
  onReorder,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const newPageRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const visible = filterPages(pages, query);
  const noMatches = pages.length > 0 && visible.length === 0;
  // Reordering a filtered list would be confusing, so it's off while searching.
  const sortable = query.trim() === '';

  // The pointer must move 4 px before a drag starts, so a click isn't a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Screen-reader messages that use page names instead of internal ids.
  const nameOf = (id: UniqueIdentifier) => displayTitle(pages.find((p) => p.id === id)?.title ?? '');
  const positionOf = (id: UniqueIdentifier) => pages.findIndex((p) => p.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. Position ${positionOf(active.id)} of ${pages.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} moved to position ${positionOf(over.id)} of ${pages.length}.`
        : `${nameOf(active.id)} is no longer over the list.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${pages.length}.`
        : `${nameOf(active.id)} dropped. Its position didn't change.`,
    onDragCancel: ({ active }) =>
      `Reorder cancelled. ${nameOf(active.id)} is back at position ${positionOf(active.id)}.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder?.(String(active.id), String(over.id));
  };

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
    // The row may be hidden by the search filter: fall back to the search box.
    (el ?? searchRef.current ?? newPageRef.current)?.focus();
  }, [focusTarget]);

  // A new page is "Untitled", so an active search could hide it.
  const handleAdd = () => {
    setQuery('');
    onAdd();
  };

  const cancelDelete = () => {
    if (pendingDelete) setFocusTarget({ kind: 'trash', id: pendingDelete.id });
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    const page = pendingDelete;
    if (!page) return;
    setPendingDelete(null);
    // Prefer a neighbour you can see; else one hidden by the search.
    const nextId = neighbourId(visible, page.id) ?? neighbourId(pages, page.id);
    await onDelete(page.id, nextId);
    setFocusTarget(nextId ? { kind: 'row', id: nextId } : { kind: 'new' });
  };

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="app-name">Notes</div>
      <button ref={newPageRef} type="button" className="new-page" onClick={handleAdd}>
        <span aria-hidden="true">+</span> New page
      </button>
      <SearchBox value={query} onChange={setQuery} inputRef={searchRef} />
      {/* Always present, so screen readers announce the message when it appears. */}
      <div aria-live="polite">{noMatches && <p className="sidebar-empty">No pages match</p>}</div>
      <nav aria-label="Pages">
        {loading ? null : pages.length === 0 ? (
          <p className="sidebar-empty">No pages yet</p>
        ) : noMatches ? null : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: dragInstructions } }}
          >
            <SortableContext items={visible.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="page-list">
                {visible.map((page) => (
                  <li key={page.id}>
                    <PageListItem
                      page={page}
                      selected={page.id === selectedId}
                      sortable={sortable}
                      onSelect={onSelect}
                      onDelete={setPendingDelete}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
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
