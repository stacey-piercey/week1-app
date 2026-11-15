import { useSortable } from '@dnd-kit/sortable';
import { displayTitle } from '../lib/search';
import type { Page } from '../types';

interface PageListItemProps {
  page: Page;
  selected: boolean;
  /** False while a search filter is active: no grip, no dragging. */
  sortable?: boolean;
  onSelect: (id: string) => void;
  onDelete: (page: Page) => void;
}

/**
 * One sidebar row: a drag grip (mouse or keyboard), the page name (opens
 * it) and a trash button.
 */
export default function PageListItem({
  page,
  selected,
  sortable = true,
  onSelect,
  onDelete,
}: PageListItemProps) {
  const name = displayTitle(page.title);
  const untitled = page.title.trim() === '';
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id, disabled: !sortable });

  // Vertical moves only; the row never slides sideways.
  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'page-row dragging' : 'page-row'}
      data-page-id={page.id}
    >
      {sortable && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="page-grip"
          {...attributes}
          {...listeners}
          aria-label={`Reorder "${name}"`}
          title="Drag to reorder"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <g fill="currentColor">
              <circle cx="6" cy="3.5" r="1.2" />
              <circle cx="10" cy="3.5" r="1.2" />
              <circle cx="6" cy="8" r="1.2" />
              <circle cx="10" cy="8" r="1.2" />
              <circle cx="6" cy="12.5" r="1.2" />
              <circle cx="10" cy="12.5" r="1.2" />
            </g>
          </svg>
        </button>
      )}
      <button
        type="button"
        className={untitled ? 'page-item untitled' : 'page-item'}
        aria-current={selected ? 'page' : undefined}
        onClick={() => onSelect(page.id)}
      >
        {name}
      </button>
      <button
        type="button"
        className="page-delete"
        aria-label={`Delete "${name}"`}
        title="Delete page"
        onClick={() => onDelete(page)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 6.5v4.5M9.25 6.5v4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
