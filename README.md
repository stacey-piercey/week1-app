# week1-app

A small Notion-like notes app that runs entirely in the browser. Pages are saved in IndexedDB, so it needs no server. See [PLAN.md](PLAN.md) for the feature plan.

Built with React, Vite and TypeScript. Tests use Vitest.

## Getting started

Requires Node 24+ and npm 11+.

```powershell
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests when files change |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built app locally |
