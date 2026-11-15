import { displayTitle } from '../lib/search';
import type { Page } from '../types';

interface PageListItemProps {
  page: Page;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (page: Page) => void;
}

/** One sidebar row: the page name (opens it) and a trash button. */
export default function PageListItem({ page, selected, onSelect, onDelete }: PageListItemProps) {
  const name = displayTitle(page.title);
  const untitled = page.title.trim() === '';
  return (
    <div className="page-row" data-page-id={page.id}>
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
