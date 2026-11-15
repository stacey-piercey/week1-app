import type { Page } from '../types';

interface PageListItemProps {
  page: Page;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function PageListItem({ page, selected, onSelect }: PageListItemProps) {
  const untitled = page.title.trim() === '';
  return (
    <button
      type="button"
      className={untitled ? 'page-item untitled' : 'page-item'}
      aria-current={selected ? 'page' : undefined}
      onClick={() => onSelect(page.id)}
    >
      {untitled ? 'Untitled' : page.title}
    </button>
  );
}
