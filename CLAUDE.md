# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- React + Vite + TypeScript
- Vitest for tests

See `PLAN.md` for the feature plan and build order.

## Commands

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:5173)
- Build: `npm run build` (type-checks first)
- Type-check only: `npm run typecheck`
- Run tests: `npm test`
- Run a single test file: `npx vitest run src/lib/storage.test.ts`
- Run tests matching a name: `npx vitest run -t "survives reopening"`
- Lint: none yet (ESLint would need new packages)

Run the tests after every change.

## Architecture

**Data flow:** `App.tsx` uses two hooks side by side:
- `hooks/usePages.ts` holds the page list and selected page in memory (it loads them from storage once, on start). Edits update this first, so the sidebar and editor change at once.
- `hooks/useAutosave.ts` writes edits to `lib/storage.ts` (IndexedDB, one `pages` store) 500 ms after typing stops. It saves at once on page switch, tab hide or close. Title and blocks share this one save path.
- `localStorage` holds only the last opened page (and the theme, from step 10).

**Editor:**
- `Editor.tsx` owns one page's block list. `Block.tsx` draws one block and handles its keys. `SlashMenu.tsx` only displays; Block handles its keys.
- Every edit goes through a pure function in `lib/blocks.ts` that returns `{ blocks, cursor }`. Editor passes the blocks up, then places the cursor after the next render.
- `lib/blockTypes.ts` is the single list of block types (menu names, screen-reader labels, search words).
- `lib/caret.ts` measures wrapped lines with a hidden mirror element, for Up/Down between blocks.

**Styles:** all colours and fonts are CSS variables in `styles/theme.css`. `styles/app.css` uses only those.

**Tests:** sit next to the file they test. jsdom has no layout, so anything that depends on wrapping or sizing is in `PLAN.md` → *Manual checks*.

## Git

- Day-to-day work happens on the `week1` branch. `main` is the base branch for pull requests.
