# Plan: Notion-like notes app

## Context
You want a small notes app in this repo, which exists only for this app. It has pages in a sidebar, an editable title, a block editor, autosave and dark mode. Your choices:
- **Stack:** React + Vite (TypeScript). Everything runs in the browser and notes are saved in IndexedDB, so there's no server.
- **Blocks:** paragraph, H1–H3, bulleted list, numbered list, to-do, quote, divider, code.
- **Sidebar:** list, add and open pages, plus delete (with confirm), drag to reorder, and search.
- **Location:** the repo root.
- **Testing:** Vitest only for now. There are no real-browser (Playwright) tests; each feature instead ends with a short manual check in the browser. We'll revisit Playwright at the block editor step (step 5), because jsdom's support for cursor position is weak there.

Node 24 and npm 11 are already installed.

**Existing files:** the root already has `README.md` and `CLAUDE.md`. I won't touch them, except to rewrite the README for the app in step 0 and to add the install, dev, build and test commands to `CLAUDE.md` once the project is scaffolded.

## Dependencies (need your OK before install)
| Package | Why |
|---|---|
| react, react-dom | UI framework |
| vite, @vitejs/plugin-react, typescript | Dev server + build |
| idb | Tiny wrapper that makes IndexedDB easier to use |
| @dnd-kit/core, @dnd-kit/sortable | Drag-to-reorder, including keyboard reordering (better accessibility than native HTML drag) |
| vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, fake-indexeddb | Unit and component tests in a simulated browser |

No editor library: I'll build the block editor myself, with one editable element per block and plain text only. Inline bold and italic are **out of scope** for v1.

**Revisit at step 5:** jsdom (Vitest's simulated browser) has weak support for cursor position in editable text. If the block editor's Enter, Backspace or arrow-key behaviour proves hard to test there, I'll propose adding Playwright (about 150–250 MB browser download) and ask first.

## Data model
```ts
Page  { id, title, order, createdAt, updatedAt, blocks: Block[] }
Block { id, type: 'p'|'h1'|'h2'|'h3'|'bullet'|'number'|'todo'|'quote'|'divider'|'code', text, checked? }
```
There is one IndexedDB store named `pages`, and the theme choice is saved in `localStorage`.

## File structure
```
index.html
package.json  vite.config.ts  tsconfig.json
src/
  main.tsx, App.tsx              # entry point + 2-column layout
  types.ts                       # Page / Block types
  lib/storage.ts                 # IndexedDB CRUD (create, list, get, update, delete, reorder)
  lib/blocks.ts                  # pure block logic: split, merge, change type, markdown shortcuts
  lib/search.ts                  # title filter
  hooks/usePages.ts              # page list state + storage calls
  hooks/useAutosave.ts           # debounced save, immediate save on close, status
  hooks/useTheme.ts              # light / dark / system
  components/Sidebar.tsx, PageListItem.tsx, SearchBox.tsx, ConfirmDialog.tsx
  components/PageTitle.tsx, Editor.tsx, Block.tsx, SlashMenu.tsx
  components/SaveStatus.tsx, ThemeToggle.tsx
  styles/theme.css               # colour tokens (CSS variables) for light + dark
  styles/app.css
  test/setup.ts                  # loads fake-indexeddb + jest-dom matchers
  **/*.test.ts(x)                # tests sit next to the file they test
```

## Build order (each step = 1–3 small commits, tests pass before moving on)

**First action after approval:** save this final plan as `PLAN.md` in the repo root and commit it on its own ("add project plan"), before any app code. If the plan changes later (for example, adding Playwright at step 5), I'll update `PLAN.md` in the same commit as that change.

**0. Scaffold:** Vite + React + TS, Vitest configured, `.gitignore` (node_modules, dist), README with run commands.
- Test: a smoke test that the app renders.
- Manual: `npm run dev` opens the app.

**1. Storage layer** (`lib/storage.ts`)
- Unit (fake-indexeddb): create returns a page with id and one empty paragraph; list is sorted by `order`; update changes `updatedAt`; delete removes the page; reorder rewrites `order`; data survives reopening the database.

**2. Sidebar: list, add, open**
- Component tests: the empty state shows a "New page" prompt; clicking "+ New page" adds and selects it; clicking a page opens it; the selected page has `aria-current`; untitled pages show "Untitled".
- Manual: create 2 pages and switch between them.

**3. Editable title**
- Component tests: typing updates the title in the sidebar live; Enter moves focus to the first block; the placeholder shows when empty.

**4. Autosave** (built before the editor so title and blocks share one save path)
- **Where it saves:** IndexedDB, in the `pages` store. localStorage is used only for the theme and the last opened page.
- **Normal saving:** 500 ms after typing stops. Each new keystroke restarts the timer.
- **Immediate save when the page is closing or hidden:** if there's an unsaved edit, it saves straight away on `visibilitychange` (when the tab is hidden), `pagehide` and `beforeunload`. The same happens when you switch to another page in the sidebar.
- *Known limit (accepted for v1):* the browser could in theory close before that last save finishes. If that ever happens in practice, we can add a localStorage backup later.
- Unit tests (Vitest fake timers, faking only `setTimeout`/`clearTimeout` so the fake database keeps working):
  - **Waits 500 ms:** type, advance 499 ms, and no save has happened; advance 1 ms more, and exactly one save happens.
  - **Typing resets the timer:** type, wait 300 ms, type again, wait 300 ms, and still no save; wait 200 ms more, and one save contains the latest text.
  - **Reload shows saved content:** render the app, type a title and some block text, advance 500 ms and let the save finish, unmount and render a fresh app (a simulated reload), and the same title and text appear.
  - **Close within 500 ms:** type, advance 100 ms, fire `pagehide`, and the save happens immediately with no wait. The same check runs with `visibilitychange` (tab hidden).
  - Status goes Saving… → Saved, and a failed save shows "Couldn't save" and retries on the next edit.
- Manual: edit a title and reload; type, close the tab at once, reopen it, and check the edit is kept.

**5. Block editor core** (paragraphs only)
- Unit (`lib/blocks.ts`): split a block at the cursor; merge with the previous block; delete an empty block.
- Component tests: Enter creates a new block below and focuses it; Backspace at the start merges up; Up and Down arrows move between blocks; the last block can't be deleted.
- Manual: type 3 paragraphs, edit in the middle of one, reload, and check the text and order.

**6. Block types**
- Slash menu: type `/` to see a filtered list, then pick with arrow keys + Enter or a click.
- Markdown shortcuts: `# ` → H1, `## ` → H2, `- ` → bullet, `1. ` → numbered, `[] ` → to-do, `> ` → quote, `---` → divider, ```` ``` ```` → code.
- Unit: shortcut detection for each pattern; changing type keeps the text.
- Component tests: the slash menu filters as you type, Escape closes it, and it works with the keyboard alone; the to-do checkbox toggles `checked`; Enter in a list continues the list and Enter on an empty list item converts it to a paragraph; numbered lists count up correctly; Enter inside a code block adds a newline instead of a new block; all types survive a simulated reload.
- Manual: build one of each type and reload.

**7. Delete page with confirm**
- Component tests: the dialog names the page; Cancel and Escape keep the page; Confirm removes it and selects a neighbouring page (or the empty state); focus returns sensibly; the deleted page is still gone after a simulated reload.

**8. Search pages**
- Unit: case-insensitive, matches part of a title, ignores surrounding spaces.
- Component tests: typing filters the list; you get a "No pages match" message when nothing matches; clearing the search restores the list.

**9. Drag to reorder** (@dnd-kit)
- Unit: the reorder function produces the correct `order` values.
- Component tests: keyboard reorder (Space, then arrow, then Space) moves the page and the order survives a simulated reload; reordering is disabled while a search filter is active, to avoid confusing results.
- Manual: drag with the mouse and reload.

**10. Dark mode**
- Colours come only from CSS variables in `theme.css`, so dark mode means swapping the tokens.
- The toggle cycles through System → Light → Dark, and the choice is saved.
- Unit: `useTheme` reads and writes localStorage and follows `prefers-color-scheme` (mocked) in System mode.
- Component tests: the toggle sets `data-theme` on `<html>`.
- Manual: check both themes look right, and that System follows the Windows setting. Contrast check: text and background meet WCAG AA in both themes.

## Defaults I've assumed (tell me if any are wrong)
- TypeScript rather than plain JS. It catches mistakes early, and you can still read it.
- No nested pages, images, inline formatting, export or multi-device sync in v1.
- Autosave debounce of 500 ms, with a small "Saved" indicator near the title.
- Layout: a fixed sidebar of about 240 px on the left and the editor on the right, centred, with a max width of about 720 px.

## Verification
- Run `npm test` for all unit and component tests (Vitest) and `npm run dev` to try the app at http://localhost:5173.
- After each feature, I run the tests, fix any failures and commit with a plain-language message. Then I walk you through what changed and give you the manual check for that step.
- Before the first install I'll show you the exact `npm install` command and what it adds.
