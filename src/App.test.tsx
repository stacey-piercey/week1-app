import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { SELECTED_PAGE_KEY } from './hooks/usePages';
import { closeDb, createPage, getPage, updatePage } from './lib/storage';

/** Create two titled pages in storage, as if from a previous session. */
async function seedTwoPages() {
  const alpha = await createPage();
  await updatePage(alpha.id, { title: 'Alpha' });
  const beta = await createPage();
  await updatePage(beta.id, { title: 'Beta' });
  return { alpha, beta };
}

const titleField = () => screen.getByRole('textbox', { name: 'Page title' });
const blockFields = () => screen.getAllByRole('textbox', { name: 'Paragraph' }) as HTMLTextAreaElement[];

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
    expect(titleField()).toHaveValue('');
    expect(screen.queryByText('No pages yet')).not.toBeInTheDocument();
  });

  it('loads saved pages and opens the one you click', async () => {
    const user = userEvent.setup();
    await seedTwoPages();
    render(<App />);

    const alpha = await screen.findByRole('button', { name: 'Alpha' });
    const beta = screen.getByRole('button', { name: 'Beta' });
    expect(alpha).toHaveAttribute('aria-current', 'page');
    expect(titleField()).toHaveValue('Alpha');

    await user.click(beta);

    expect(beta).toHaveAttribute('aria-current', 'page');
    expect(alpha).not.toHaveAttribute('aria-current');
    expect(titleField()).toHaveValue('Beta');
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
    expect(titleField()).toHaveValue('Beta');
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

  describe('editable title', () => {
    it('typing updates the page name in the sidebar live', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.clear(titleField());
      expect(screen.getByRole('button', { name: 'Untitled' })).toHaveAttribute('aria-current', 'page');

      await user.type(titleField(), 'Shopping');
      expect(screen.getByRole('button', { name: 'Shopping' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
    });

    it('keeps an edited title when you switch pages and back', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), ' edited');
      await user.click(screen.getByRole('button', { name: 'Beta' }));
      expect(titleField()).toHaveValue('Beta');

      await user.click(screen.getByRole('button', { name: 'Alpha edited' }));
      expect(titleField()).toHaveValue('Alpha edited');
    });

    it('New page puts the cursor in the new title', async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText('No pages yet');

      await user.click(screen.getByRole('button', { name: 'New page' }));

      await screen.findByRole('button', { name: 'Untitled' });
      expect(titleField()).toHaveFocus();
    });

    it('Enter in the title puts the cursor at the start of the first block', async () => {
      const user = userEvent.setup();
      const { alpha } = await seedTwoPages();
      await updatePage(alpha.id, { blocks: [{ id: 'b1', type: 'p', text: 'Body' }] });
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), '{Enter}');

      const first = blockFields()[0];
      expect(first).toHaveFocus();
      expect(first.selectionStart).toBe(0);
      expect(titleField()).toHaveValue('Alpha'); // Enter didn't change the title
    });

    it('opening an existing page does not move focus to the title', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      const beta = await screen.findByRole('button', { name: 'Beta' });

      await user.click(beta);

      expect(titleField()).not.toHaveFocus();
      expect(beta).toHaveFocus();
    });
  });

  // Real timers here: Testing Library's findBy/waitFor hang under Vitest fake
  // timers. The exact 500 ms timing is covered in useAutosave.test.ts.
  describe('autosave', () => {
    it('a saved title and blocks are still there after a reload', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      const first = render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.clear(titleField());
      await user.type(titleField(), 'Groceries');
      expect(screen.getByRole('status')).toHaveTextContent('Saving…');
      // Three paragraphs, then an edit in the middle one.
      await user.type(blockFields()[0], 'Milk{Enter}Eggs{Enter}Bread');
      await user.type(blockFields()[1], ' (6)');

      // The real 500 ms delay passes, then the save finishes.
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'), { timeout: 2000 });

      // Simulated reload: unmount, close the database, render a fresh app.
      first.unmount();
      await closeDb();
      render(<App />);

      expect(await screen.findByRole('button', { name: 'Groceries' })).toHaveAttribute('aria-current', 'page');
      expect(titleField()).toHaveValue('Groceries');
      expect(blockFields().map((f) => f.value)).toEqual(['Milk', 'Eggs (6)', 'Bread']);
    });

    it('every block type and a ticked to-do are still there after a reload', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      const first = render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      // One of each type, made with markdown shortcuts. An extra Enter ends
      // each list. "[[" types a single "[" in user-event.
      await user.type(
        blockFields()[0],
        '# Big{Enter}## Mid{Enter}### Small{Enter}' +
          '- Bullet{Enter}{Enter}1. Number{Enter}{Enter}[[] Task{Enter}{Enter}' +
          '> Quote{Enter}```x = 1{Control>}{Enter}{/Control}---End',
      );
      await user.click(screen.getByRole('checkbox', { name: 'Done' }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'), { timeout: 2000 });

      // Simulated reload: unmount, close the database, render a fresh app.
      first.unmount();
      await closeDb();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      const blocks = (screen.getAllByRole('textbox') as HTMLTextAreaElement[])
        .filter((f) => f !== titleField())
        .map((f) => `${f.getAttribute('aria-label')}: ${f.value}`);
      expect(blocks).toEqual([
        'Heading 1: Big',
        'Heading 2: Mid',
        'Heading 3: Small',
        'Bulleted list item: Bullet',
        'Numbered list item: Number',
        'To-do: Task',
        'Quote: Quote',
        'Code: x = 1',
        'Paragraph: End',
      ]);
      expect(screen.getByRole('checkbox', { name: 'Done' })).toBeChecked();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('switching pages saves the edit at once, without waiting 500 ms', async () => {
      const user = userEvent.setup();
      const { alpha } = await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), ' edited');
      await user.click(screen.getByRole('button', { name: 'Beta' }));

      // Saved well within 500 ms, so it must be the immediate save, not the timer.
      await waitFor(async () => expect((await getPage(alpha.id))?.title).toBe('Alpha edited'), {
        timeout: 300,
      });
      // Alpha's save finished after the switch, but Beta doesn't show "Saved".
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('opening another page clears "Saved"', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), ' edited');
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'), { timeout: 2000 });

      await user.click(screen.getByRole('button', { name: 'Beta' }));
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });
});
