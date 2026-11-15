import type { Page } from '../types';
import PageListItem from './PageListItem';

interface SidebarProps {
  pages: Page[];
  selectedId: string | null;
  loading?: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
}

export default function Sidebar({ pages, selectedId, loading = false, onAdd, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="app-name">Notes</div>
      <button type="button" className="new-page" onClick={() => onAdd()}>
        <span aria-hidden="true">+</span> New page
      </button>
      <nav aria-label="Pages">
        {loading ? null : pages.length === 0 ? (
          <p className="sidebar-empty">No pages yet</p>
        ) : (
          <ul className="page-list">
            {pages.map((page) => (
              <li key={page.id}>
                <PageListItem page={page} selected={page.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
