import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { closeDb } from '../lib/storage';

beforeEach(() => {
  // A brand-new, empty fake database and empty localStorage for every test.
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

afterEach(async () => {
  // Unmount rendered components (needed because Vitest globals are off).
  cleanup();
  await closeDb();
  vi.restoreAllMocks();
});
