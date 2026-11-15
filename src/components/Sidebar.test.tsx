import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { stackRows } from '../test/stackRows';
import type { Page } from '../types';
import Sidebar from './Sidebar';

function makePage(id: string, title: string, order: number): Page {
  return { id, title, order, createdAt: 0, updatedAt: 0, blocks: [] };
}

function renderSidebar(props: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const all = {
    pages: [],
    selectedId: null,
    onAdd: vi.fn(),
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  render(<Sidebar {...all} />);
  return all;
}

const threePages = [makePage('a', 'Alpha', 0), makePage('b', 'Beta', 1), makePage('c', 'Gamma', 2)];

describe('Sidebar', () => {
  it('shows an empty state with a New page prompt when there are no pages', () => {
    renderSidebar();
    expect(screen.getByText('No pages yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument();
  });

  it('shows "Untitled" for a page with an empty title', () => {
    renderSidebar({ pages: [makePage('a', '', 0)] });
    expect(screen.getByRole('button', { name: 'Untitled' })).toBeInTheDocument();
  });

  it('marks only the selected page with aria-current', () => {
    renderSidebar({ pages: [makePage('a', 'Alpha', 0), makePage('b', 'Beta', 1)], selectedId: 'b' });
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the page id and onAdd for New page', async () => {
    const user = userEvent.setup();
    const { onAdd, onSelect } = renderSidebar({ pages: [makePage('a', 'Alpha', 0)] });
    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onSelect).toHaveBeenCalledWith('a');
    await user.click(screen.getByRole('button', { name: 'New page' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  describe('delete', () => {
    it('each row has a trash button named after its page', () => {
      renderSidebar({ pages: [makePage('a', 'Alpha', 0), makePage('b', '', 1)] });
      expect(screen.getByRole('button', { name: 'Delete "Alpha"' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete "Untitled"' })).toBeInTheDocument();
    });

    it('the dialog names the page and starts on Cancel', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      await user.click(screen.getByRole('button', { name: 'Delete "Beta"' }));

      const dialog = screen.getByRole('dialog', { name: 'Delete "Beta"?' });
      expect(dialog).toHaveAccessibleDescription("This can't be undone.");
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it.each([
      ['Cancel', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape', (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
      ['a backdrop click', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('dialog'))],
    ])('%s keeps the page and returns focus to the trash button', async (_name, cancel) => {
      const user = userEvent.setup();
      const { onDelete } = renderSidebar({ pages: threePages });
      const trash = screen.getByRole('button', { name: 'Delete "Beta"' });
      await user.click(trash);

      await cancel(user);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
      expect(trash).toHaveFocus();
    });

    it('Delete passes the page below as the next page', async () => {
      const user = userEvent.setup();
      const { onDelete } = renderSidebar({ pages: threePages });
      await user.click(screen.getByRole('button', { name: 'Delete "Beta"' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith('b', 'c');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('deleting the last page passes the page above', async () => {
      const user = userEvent.setup();
      const { onDelete } = renderSidebar({ pages: threePages });
      await user.click(screen.getByRole('button', { name: 'Delete "Gamma"' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith('c', 'b');
    });

    it('while searching, the next page comes from the visible list', async () => {
      const user = userEvent.setup();
      const pages = [
        makePage('a', 'Apple', 0),
        makePage('b', 'Banana', 1),
        makePage('c', 'Apricot', 2),
      ];
      const { onDelete } = renderSidebar({ pages });
      await user.type(screen.getByRole('searchbox', { name: 'Search pages' }), 'ap');
      await user.click(screen.getByRole('button', { name: 'Delete "Apple"' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      // Banana is next in the full list, but hidden by the search.
      expect(onDelete).toHaveBeenCalledWith('a', 'c');
    });

    it('deleting the only page passes null', async () => {
      const user = userEvent.setup();
      const { onDelete } = renderSidebar({ pages: [makePage('a', 'Alpha', 0)] });
      await user.click(screen.getByRole('button', { name: 'Delete "Alpha"' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith('a', null);
    });
  });

  describe('search', () => {
    const searchBox = () => screen.getByRole('searchbox', { name: 'Search pages' });
    const pageNames = () =>
      screen
        .queryAllByRole('button', { name: /^(?!Delete|Reorder|New page)/ })
        .map((b) => b.textContent);

    it('typing filters the list', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      await user.type(searchBox(), 'MM');
      expect(pageNames()).toEqual(['Gamma']);
    });

    it('shows "No pages match" when nothing matches', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      expect(screen.queryByText('No pages match')).not.toBeInTheDocument();
      await user.type(searchBox(), 'zzz');
      expect(screen.getByText('No pages match')).toBeInTheDocument();
      expect(pageNames()).toEqual([]);
    });

    it('clearing the search restores the list', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      await user.type(searchBox(), 'zzz');
      await user.clear(searchBox());
      expect(pageNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(screen.queryByText('No pages match')).not.toBeInTheDocument();
    });

    it('Escape clears the search', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      await user.type(searchBox(), 'alp{Escape}');
      expect(searchBox()).toHaveValue('');
      expect(pageNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('New page clears the search', async () => {
      const user = userEvent.setup();
      const { onAdd } = renderSidebar({ pages: threePages });
      await user.type(searchBox(), 'alp');
      await user.click(screen.getByRole('button', { name: 'New page' }));
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(searchBox()).toHaveValue('');
    });
  });

  describe('reorder', () => {
    it('each row has a grip named after its page', () => {
      renderSidebar({ pages: [makePage('a', 'Alpha', 0), makePage('b', '', 1)] });
      expect(screen.getByRole('button', { name: 'Reorder "Alpha"' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reorder "Untitled"' })).toBeInTheDocument();
    });

    it('the grips are hidden while searching and come back after', async () => {
      const user = userEvent.setup();
      renderSidebar({ pages: threePages });
      const search = screen.getByRole('searchbox', { name: 'Search pages' });
      await user.type(search, 'a');
      expect(screen.queryAllByRole('button', { name: /^Reorder/ })).toEqual([]);
      await user.clear(search);
      expect(screen.getAllByRole('button', { name: /^Reorder/ })).toHaveLength(3);
    });

    it('Space, Down, Space on a grip moves the page down one place', async () => {
      stackRows();
      const user = userEvent.setup();
      const onReorder = vi.fn();
      renderSidebar({ pages: threePages, onReorder });

      screen.getByRole('button', { name: 'Reorder "Alpha"' }).focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Space]');

      expect(onReorder).toHaveBeenCalledWith('a', 'b');
    });

    it('Escape cancels a keyboard move', async () => {
      stackRows();
      const user = userEvent.setup();
      const onReorder = vi.fn();
      renderSidebar({ pages: threePages, onReorder });

      screen.getByRole('button', { name: 'Reorder "Alpha"' }).focus();
      await user.keyboard('[Space][ArrowDown][Escape]');

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('clicking a grip neither opens nor moves the page', async () => {
      const user = userEvent.setup();
      const onReorder = vi.fn();
      const { onSelect } = renderSidebar({ pages: threePages, onReorder });
      await user.click(screen.getByRole('button', { name: 'Reorder "Beta"' }));
      expect(onSelect).not.toHaveBeenCalled();
      expect(onReorder).not.toHaveBeenCalled();
    });
  });
});
