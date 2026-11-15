import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { closeDb } from '../lib/storage';

// jsdom has <dialog> but not its showModal()/close() methods. These stand-ins
// only toggle `open`; the browser's real focus trap and backdrop aren't faked.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

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
