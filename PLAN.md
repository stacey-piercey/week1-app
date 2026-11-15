# Plan: Notion-like notes app

## Context
You want a small notes app in this repo, which exists only for this app. It has pages in a sidebar, an editable title, a block editor, autosave and dark mode. Your choices:
- **Stack:** React + Vite (TypeScript). Everything runs in the browser and notes are saved in IndexedDB, so there's no server.
- **Blocks:** paragraph, H1–H3, bulleted list, numbered list, to-do, quote, divider, code.
- **Sidebar:** list, add and open pages, plus delete (with confirm), drag to reorder, and search.
- **Location:** the repo root.
- **Testing:** Vitest only. There are no real-browser (Playwright) tests; each feature instead ends with a short manual check in the browser. **Decision at step 5:** No Playwright for step 5. Reason: I'm an experienced UI tester; cursor behavior in wrapped text is covered by the manual checklist (see *Manual checks*).

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

**Decided at step 5:** no Playwright. jsdom covers the cursor logic (split, merge, focus moves). The behaviour that needs real layout is covered by *Manual checks → Block editor*.

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
- A one-row textarea that wraps long titles and grows to fit. Enter is blocked and pasted line breaks become spaces. A newly created page focuses its title.
- Titles are kept in memory only until step 4 adds autosave.
- Component tests: typing updates the title in the sidebar live; Enter calls an `onEnter` hook (step 5 connects it to the first block); the placeholder shows when empty.

**4. Autosave** (built before the editor so title and blocks share one save path)
- **Where it saves:** IndexedDB, in the `pages` store. localStorage is used only for the theme and the last opened page.
- **Normal saving:** 500 ms after typing stops. Each new keystroke restarts the timer.
- **Immediate save when the page is closing or hidden:** if there's an unsaved edit, it saves straight away on `visibilitychange` (when the tab is hidden), `pagehide` and `beforeunload`. The same happens when you switch to another page in the sidebar.
- *Known limit (accepted for v1):* the browser could in theory close before that last save finishes. If that ever happens in practice, we can add a localStorage backup later.
- Unit tests (Vitest fake timers, faking only `setTimeout`/`clearTimeout` so the fake database keeps working):
  - **Waits 500 ms:** type, advance 499 ms, and no save has happened; advance 1 ms more, and exactly one save happens.
  - **Typing resets the timer:** type, wait 300 ms, type again, wait 300 ms, and still no save; wait 200 ms more, and one save contains the latest text.
  - **Reload shows saved content:** render the app, type a title and some block text, advance 500 ms and let the save finish, unmount and render a fresh app (a simulated reload), and the same title and text appear.
    - *Done in step 4 for the title only (blocks don't exist yet). Step 5 adds block text to this test. App-level tests use real timers, because Testing Library's `findBy`/`waitFor` hang under Vitest fake timers. The exact 500 ms timing is tested in `useAutosave.test.ts`.*
  - **Close within 500 ms:** type, advance 100 ms, fire `pagehide`, and the save happens immediately with no wait. The same check runs with `visibilitychange` (tab hidden).
  - Status goes Saving… → Saved, and a failed save shows "Couldn't save" and retries on the next edit.
- Manual: edit a title and reload; type, close the tab at once, reopen it, and check the edit is kept.

**5. Block editor core** (paragraphs only)
- Unit (`lib/blocks.ts`): split a block at the cursor; merge with the previous block; delete an empty block.
- Component tests: Enter in the page title moves focus to the first block; Enter creates a new block below and focuses it; Backspace at the start merges up; Up and Down arrows move between blocks; the last block can't be deleted.
- Manual: run the *Manual checks → Block editor* list.

**6. Block types**
- Slash menu: type `/` to see a filtered list, then pick with arrow keys + Enter or a click.
- Markdown shortcuts: `# ` → H1, `## ` → H2, `### ` → H3, `- ` → bullet, `1. ` → numbered, `[] ` → to-do, `> ` → quote, `---` → divider, ```` ``` ```` → code. They work in paragraphs only, and only when the cursor is right after the marker (so pasted text doesn't convert).
- **Decided at step 6:**
  - **Code block exit:** Ctrl+Enter adds a paragraph below. Plain Enter adds a newline.
  - **Backspace at the start of a formatted block:** the first press turns it into a paragraph. The second press merges it into the block above.
  - **Divider:** can't take focus, and Up/Down skip over it. Backspace at the start of the block below removes it. Creating one always leaves an empty paragraph below it.
  - **Slash menu:** opens on `/` at the start of a block or after a space. Picking a type removes the `/query` text and keeps the rest.
  - **Enter at the start of a block with text:** adds an empty paragraph above, and the block keeps its type.
- Unit: shortcut detection for each pattern; changing type keeps the text.
- Component tests: the slash menu filters as you type, Escape closes it, and it works with the keyboard alone; the to-do checkbox toggles `checked`; Enter in a list continues the list and Enter on an empty list item converts it to a paragraph; numbered lists count up correctly; Enter inside a code block adds a newline instead of a new block; all types survive a simulated reload.
- Manual: run the *Manual checks → Block types* list.
- *Known limits (v1):* dividers can't be removed with the mouse. Lists are separate blocks, not `<ul>`/`<ol>` markup; each block's label tells screen readers its type.

**7. Sidebar: delete and search** (old steps 7 and 8, merged because they change the same files)
- **Delete:** each sidebar row has a trash button (shown on hover, on focus, and on the selected row). It opens a native `<dialog>`: *Delete "Title"?*, with Cancel (focused first) and Delete.
  - Cancel, Escape or a backdrop click keeps the page and returns focus to the trash button.
  - Delete opens the page below (or above if it was last), or the empty state. Focus moves to that row, or to "+ New page".
  - Autosave drops any unsaved edit for the deleted page and waits for a running save, so it never shows "Couldn't save" for a page that's gone.
- **Search:** a search box under "+ New page" filters the list by title. It's case-insensitive, matches part of a title and ignores surrounding spaces. Untitled pages match "untitled". "No pages match" shows when nothing matches. Escape or clearing restores the list. "+ New page" clears the search. While filtering, the neighbour picked after a delete comes from the visible list.
- Unit: the search filter; autosave `discard` drops a pending edit.
- Component tests: the dialog names the page; Cancel and Escape keep the page; Delete selects the right neighbour or the empty state; focus returns sensibly; the deleted page is still gone after a simulated reload; deleting right after typing never shows "Couldn't save"; typing filters; "No pages match"; clearing restores the list; "+ New page" clears the search.
- Manual: run the *Manual checks → Delete and search* list.

**8. Drag to reorder** (@dnd-kit)
- **Decided at step 8:** a ⋮⋮ grip at the left of each row is the only drag handle, for both mouse and keyboard, because the page name button already uses Space/Enter to open the page. The grip shows on hover, on focus and on the open page's row, like the trash button, and it's hidden while searching. Page names are indented to make room for it. A drag starts only after the pointer moves 4 px, so a click on the grip does nothing. Screen-reader announcements use page names and positions.
- Unit: the reorder function produces the correct `order` values; `usePages.reorderPage` saves the new order and restores the old one if the save fails.
- Component tests: keyboard reorder (Space, then arrow, then Space) moves the page and the order survives a simulated reload; Escape cancels; reordering is disabled while a search filter is active, to avoid confusing results.
- *Test note:* jsdom has no layout, so the keyboard tests stack the rows 32 px apart with a mock (`src/test/stackRows.ts`).
- Manual: run the *Manual checks → Drag to reorder* list.

**9. Dark mode**
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

## Manual checks
Rerun the same way every time: `npm run dev`, open http://localhost:5173, and start with a new page.

### Block editor (step 5)
1. **Title to first block:** click in the title and press Enter. The cursor moves to the first block.
2. **Split:** type "Hello world", click between "Hello" and " world", and press Enter. You get two blocks, "Hello" and " world", with the cursor at the start of the second.
3. **Merge:** press Backspace. The blocks rejoin as "Hello world", with the cursor between "Hello" and " world".
4. **Wrapped text, Up/Down inside the paragraph:** type a paragraph long enough to wrap onto at least 3 lines, with a block above and below it. Put the cursor on the middle line: Up and Down move one line within the paragraph and don't leave it.
5. **Wrapped text, leaving the paragraph:** from the paragraph's first line, Up goes to the block above. From its last line, Down goes to the block below.
6. **Horizontal position:** put the cursor near the middle of a line and press Up/Down across blocks. It lands near the same horizontal position, not always at the start or end.
7. **Grows to fit:** while you type the wrapped paragraph, the block grows line by line and never shows a scrollbar or hides text. Narrow the window: it re-wraps and still fits.
8. **Cursor stays put:** type quickly in the middle of a block. The cursor never jumps to the end.
9. **Last block:** clear all blocks down to one empty block, then press Backspace. The block stays.
10. **Reload:** type 3 paragraphs, edit the middle one, wait for "Saved", and reload. The text and order are unchanged.
11. *(Optional, if you have a Japanese or other IME installed)* While composing with the IME, press Enter to confirm a word. It confirms the word and doesn't split the block.

### Block types (step 6)
1. **Shortcuts:** in an empty paragraph, type each of `# `, `## `, `### `, `- `, `1. `, `[] `, `> `, ```` ``` ```` and `---` (one per block). Each turns into the right type, the marker disappears, and the cursor stays in the block. Check the styles: heading sizes, bullet, number, checkbox, quote bar, grey code box and divider line.
2. **Markers line up:** the bullet, number and checkbox sit level with the first line of their text, including when the text wraps.
3. **Lists:** type 3 numbered items. They read 1, 2, 3. Press Enter on the empty 4th item: it becomes a paragraph. Start a new numbered item below it, and it counts from 1 again.
4. **To-do:** click the checkbox. The text is struck through and muted. Tab to the checkbox and press Space: it toggles back.
5. **Code:** Enter adds a new line inside the box, and the box grows. Ctrl+Enter starts a paragraph below. Long lines wrap with no horizontal scrollbar.
6. **Backspace:** at the start of a heading, the first press turns it into plain text and the second joins it to the block above. Below a divider, Backspace at the start removes the divider.
7. **Up/Down past a divider:** the cursor jumps over it to the block on the other side.
8. **Slash menu, keyboard only:** type `/`, then `head`. The list narrows to 3 headings. Use Down, then Enter: the block becomes Heading 2. Type `/` again, press Up, and the highlight wraps to Code. Press Escape: the menu closes and `/` stays as text.
9. **Slash menu, mouse:** type `/` and click Quote. Focus stays in the block. Clicking elsewhere on the page closes an open menu.
10. **Slash in text:** typing `and/or` or a URL doesn't open the menu. `Note /` does.
11. **Long menu:** in a block near the bottom of the window, type `/` and arrow down to Code. The list scrolls so the highlighted item stays visible.
12. **Screen reader (Narrator, Ctrl+Win+Enter):** with the menu open, Up/Down announce each option's name.
13. **Reload:** with one block of each type and a ticked to-do, wait for "Saved" and reload. Everything comes back the same.

### Delete and search (step 7)
1. **Trash button:** hover a row and the trash button appears. It's always visible on the open page's row. Tab reaches it.
2. **Delete the open page:** with 3 pages, open the middle one and delete it. The page below opens.
3. **Cancel:** open the dialog and press Cancel, then Escape, then click the backdrop. The page stays each time, and focus is back on the trash button.
4. **Last page:** delete pages until none are left. The empty state shows, and focus is on "+ New page".
5. **Reload:** reload after deleting. The deleted pages stay gone.
6. **Delete right after typing:** type in a page and delete it within half a second. No "Couldn't save" appears.
7. **Search:** type `GRO` to find "Groceries". Nonsense text shows "No pages match". Escape brings the full list back.
8. **New page while filtering:** with a search active, press "+ New page". The search clears and the new page shows.
9. **Screen reader (Narrator):** the dialog title is read when it opens; the trash button reads as *Delete "Title"*.

### Drag to reorder (step 8)
1. **Grip:** hover a row and the ⋮⋮ grip appears at the left. It's always visible on the open page's row. Tab reaches it before the page name.
2. **Mouse:** with 3 pages, drag the top one by its grip to the bottom. The others slide out of the way, and the dragged row looks lifted. Reload: the new order is kept.
3. **Click isn't a drag:** click the grip without moving. Nothing opens and nothing moves.
4. **Keyboard:** Tab to a grip, press Space, then Down, then Space. The page moves down one place, and focus stays on its grip.
5. **Cancel:** pick up with Space, press Down, then Escape. The page goes back where it was.
6. **Screen reader (Narrator):** on a grip you hear *Reorder "Title"* and the instructions. Picking up, moving and dropping each announce the page name and position (e.g. *"Groceries moved to position 2 of 3"*).
7. **While searching:** type in the search box. There are no grips. Clear the search and they come back.
8. **New page after reorder:** reorder, then press "+ New page". The new page goes to the bottom.

## Verification
- Run `npm test` for all unit and component tests (Vitest) and `npm run dev` to try the app at http://localhost:5173.
- After each feature, I run the tests, fix any failures and commit with a plain-language message. Then I walk you through what changed and give you the manual check for that step.
- Before the first install I'll show you the exact `npm install` command and what it adds.
