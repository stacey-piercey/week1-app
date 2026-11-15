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

Add a short architecture overview once the code spans more than a few files.

## Git

- Day-to-day work happens on the `week1` branch. `main` is the base branch for pull requests.
