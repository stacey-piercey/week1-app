import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { SELECTED_PAGE_KEY } from './hooks/usePages';
import { closeDb, createPage, getPage, listPages, updatePage } from './lib/storage';
import { stackRows } from './test/stackRows';

/** Create two titled pages in storage, as if from a previous session. */
async function seedTwoPages() {
  const alpha = await createPage();
  await updatePage(alpha.id, { title: 'Alpha' });
  const beta = await createPage();
  await updatePage(beta.id, { title: 'Beta' });
  return { alpha, beta };
}

const titleField = () => screen.getByRole('textbox', { name: 'Page title' });
// The autosave indicator. Not getByRole('status'): dnd-kit adds its own
// status region for drag announcements.
const saveStatus = () => {
  const el = document.querySelector<HTMLElement>('.save-status');
  if (!el) throw new Error('No save status on screen');
  return el;
};
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
      expect(saveStatus()).toHaveTextContent('Saving…');
      // Three paragraphs, then an edit in the middle one.
      await user.type(blockFields()[0], 'Milk{Enter}Eggs{Enter}Bread');
      await user.type(blockFields()[1], ' (6)');

      // The real 500 ms delay passes, then the save finishes.
      await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'), { timeout: 2000 });

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
      await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'), { timeout: 2000 });

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
      expect(saveStatus()).toBeEmptyDOMElement();
    });

    it('opening another page clears "Saved"', async () => {
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), ' edited');
      await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'), { timeout: 2000 });

      await user.click(screen.getByRole('button', { name: 'Beta' }));
      expect(saveStatus()).toBeEmptyDOMElement();
    });
  });

  describe('delete page', () => {
    /** Click a page's trash button, then Delete in the dialog. */
    async function deletePageNamed(user: ReturnType<typeof userEvent.setup>, name: string) {
      await user.click(screen.getByRole('button', { name: `Delete "${name}"` }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
    }

    async function seedThreePages() {
      const { alpha, beta } = await seedTwoPages();
      const gamma = await createPage();
      await updatePage(gamma.id, { title: 'Gamma' });
      return { alpha, beta, gamma };
    }

    it('deleting the open page opens the one below and focuses it', async () => {
      const user = userEvent.setup();
      await seedThreePages();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Beta' }));

      await deletePageNamed(user, 'Beta');

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument());
      const gamma = screen.getByRole('button', { name: 'Gamma' });
      expect(gamma).toHaveAttribute('aria-current', 'page');
      expect(gamma).toHaveFocus();
      expect(titleField()).toHaveValue('Gamma');
    });

    it('deleting the open last page opens the one above', async () => {
      const user = userEvent.setup();
      await seedThreePages();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Gamma' }));

      await deletePageNamed(user, 'Gamma');

      await waitFor(() => expect(titleField()).toHaveValue('Beta'));
      expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    });

    it('deleting a page that is not open leaves the open page alone', async () => {
      const user = userEvent.setup();
      await seedThreePages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' }); // Alpha is open

      await deletePageNamed(user, 'Gamma');

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Gamma' })).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-current', 'page');
      expect(titleField()).toHaveValue('Alpha');
    });

    it('deleting the only page shows the empty state, with focus on New page', async () => {
      const user = userEvent.setup();
      const page = await createPage();
      await updatePage(page.id, { title: 'Only' });
      render(<App />);
      await screen.findByRole('button', { name: 'Only' });

      await deletePageNamed(user, 'Only');

      expect(await screen.findByText('No pages yet')).toBeInTheDocument();
      expect(screen.getByText('Create a page to get started.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'New page' })).toHaveFocus());
    });

    it('a deleted page is still gone after a reload, and the next page is remembered', async () => {
      const user = userEvent.setup();
      const { beta } = await seedThreePages();
      const first = render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Beta' }));

      await deletePageNamed(user, 'Beta');
      await waitFor(() => expect(titleField()).toHaveValue('Gamma'));
      expect(await getPage(beta.id)).toBeUndefined();

      // Simulated reload: unmount, close the database, render a fresh app.
      first.unmount();
      await closeDb();
      render(<App />);

      expect(await screen.findByRole('button', { name: 'Gamma' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
    });

    it('deleting right after typing never shows "Couldn\'t save"', async () => {
      const user = userEvent.setup();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { alpha } = await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      await user.type(titleField(), ' edited'); // not saved yet: 500 ms hasn't passed
      await deletePageNamed(user, 'Alpha edited');
      await waitFor(() => expect(titleField()).toHaveValue('Beta'));

      // Wait past the autosave delay: nothing tries to save the deleted page.
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(screen.queryByText("Couldn't save")).not.toBeInTheDocument();
      expect(errors).not.toHaveBeenCalled();
      expect(await getPage(alpha.id)).toBeUndefined();
    });
  });

  describe('reorder', () => {
    const pageNames = () =>
      screen
        .getAllByRole('button', { name: /^(?!Delete|Reorder|New page|Theme)/ })
        .map((b) => b.textContent);

    it('a keyboard move is still there after a reload', async () => {
      stackRows();
      const user = userEvent.setup();
      await seedTwoPages();
      const first = render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      screen.getByRole('button', { name: 'Reorder "Alpha"' }).focus();
      await user.keyboard('[Space][ArrowDown][Space]');

      await waitFor(() => expect(pageNames()).toEqual(['Beta', 'Alpha']));
      await waitFor(async () =>
        expect((await listPages()).map((p) => p.title)).toEqual(['Beta', 'Alpha']),
      );

      // Simulated reload: unmount, close the database, render a fresh app.
      first.unmount();
      await closeDb();
      render(<App />);

      await screen.findByRole('button', { name: 'Alpha' });
      expect(pageNames()).toEqual(['Beta', 'Alpha']);
    });

    it('a new page made after a reorder goes to the bottom', async () => {
      stackRows();
      const user = userEvent.setup();
      await seedTwoPages();
      render(<App />);
      await screen.findByRole('button', { name: 'Alpha' });

      screen.getByRole('button', { name: 'Reorder "Beta"' }).focus();
      await user.keyboard('[Space][ArrowUp][Space]');
      await waitFor(() => expect(pageNames()).toEqual(['Beta', 'Alpha']));
      await user.click(screen.getByRole('button', { name: 'New page' }));

      await waitFor(() => expect(pageNames()).toEqual(['Beta', 'Alpha', 'Untitled']));
    });
  });

  describe('theme', () => {
    const htmlTheme = () => document.documentElement.dataset.theme;

    it('the toggle sets data-theme on <html>, and the choice survives a reload', async () => {
      const user = userEvent.setup();
      const first = render(<App />);
      await screen.findByText('No pages yet');
      expect(htmlTheme()).toBe('light'); // System, and the system is light

      await user.click(screen.getByRole('button', { name: 'Theme: System' }));
      expect(htmlTheme()).toBe('light');
      await user.click(screen.getByRole('button', { name: 'Theme: Light' }));
      expect(htmlTheme()).toBe('dark');
      expect(screen.getByRole('button', { name: 'Theme: Dark' })).toHaveFocus();

      // Simulated reload.
      first.unmount();
      delete document.documentElement.dataset.theme;
      render(<App />);

      expect(await screen.findByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
      expect(htmlTheme()).toBe('dark');
    });
  });
});
