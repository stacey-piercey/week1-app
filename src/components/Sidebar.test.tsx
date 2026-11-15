import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Page } from '../types';
import Sidebar from './Sidebar';

function makePage(id: string, title: string, order: number): Page {
  return { id, title, order, createdAt: 0, updatedAt: 0, blocks: [] };
}

describe('Sidebar', () => {
  it('shows an empty state with a New page prompt when there are no pages', () => {
    render(<Sidebar pages={[]} selectedId={null} onAdd={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('No pages yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument();
  });

  it('shows "Untitled" for a page with an empty title', () => {
    render(
      <Sidebar pages={[makePage('a', '', 0)]} selectedId={null} onAdd={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Untitled' })).toBeInTheDocument();
  });

  it('marks only the selected page with aria-current', () => {
    const pages = [makePage('a', 'Alpha', 0), makePage('b', 'Beta', 1)];
    render(<Sidebar pages={pages} selectedId="b" onAdd={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the page id and onAdd for New page', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onSelect = vi.fn();
    render(
      <Sidebar pages={[makePage('a', 'Alpha', 0)]} selectedId={null} onAdd={onAdd} onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onSelect).toHaveBeenCalledWith('a');
    await user.click(screen.getByRole('button', { name: 'New page' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
