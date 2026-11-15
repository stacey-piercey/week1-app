import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { SELECTED_PAGE_KEY } from './hooks/usePages';
import { closeDb, createPage, updatePage } from './lib/storage';

/** Create two titled pages in storage, as if from a previous session. */
async function seedTwoPages() {
  const alpha = await createPage();
  await updatePage(alpha.id, { title: 'Alpha' });
  const beta = await createPage();
  await updatePage(beta.id, { title: 'Beta' });
  return { alpha, beta };
}

describe('App', () => {
  it('renders the app name and the empty state', async () => {
    render(<App />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(await screen.findByText('No pages yet')).toBeInTheDocument();
    expect(screen.getByText('Create a page to get started.')).toBeInTheDocument();
  });

  it('clicking New page adds the page, selects it and opens it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No pages yet');

    await user.click(screen.getByRole('button', { name: 'New page' }));

    const item = await screen.findByRole('button', { name: 'Untitled' });
    expect(item).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Untitled' })).toBeInTheDocument();
    expect(screen.queryByText('No pages yet')).not.toBeInTheDocument();
  });

  it('loads saved pages and opens the one you click', async () => {
    const user = userEvent.setup();
    await seedTwoPages();
    render(<App />);

    const alpha = await screen.findByRole('button', { name: 'Alpha' });
    const beta = screen.getByRole('button', { name: 'Beta' });
    expect(alpha).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument();

    await user.click(beta);

    expect(beta).toHaveAttribute('aria-current', 'page');
    expect(alpha).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 1, name: 'Beta' })).toBeInTheDocument();
  });

  it('remembers the selected page across a reload', async () => {
    const user = userEvent.setup();
    await seedTwoPages();
    const first = render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Beta' }));

    // Simulated reload: unmount, close the database, render a fresh app.
    first.unmount();
    await closeDb();
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Beta' })).toBeInTheDocument();
  });

  it('selects the first page when the saved page no longer exists', async () => {
    await seedTwoPages();
    localStorage.setItem(SELECTED_PAGE_KEY, 'deleted-page-id');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-current', 'page');
  });

  it('selects the first page when nothing was saved', async () => {
    await seedTwoPages();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-current', 'page');
  });
});
