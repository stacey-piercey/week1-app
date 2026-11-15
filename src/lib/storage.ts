import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Page } from '../types';

const DB_NAME = 'notes-app';
const DB_VERSION = 1;

interface NotesDB extends DBSchema {
  pages: { key: string; value: Page };
}

let dbPromise: Promise<IDBPDatabase<NotesDB>> | null = null;

function getDb(): Promise<IDBPDatabase<NotesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NotesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('pages', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

/** Close the connection. The next call reopens it (used to simulate a reload). */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export async function listPages(): Promise<Page[]> {
  const db = await getDb();
  const pages = await db.getAll('pages');
  return pages.sort((a, b) => a.order - b.order);
}

export async function getPage(id: string): Promise<Page | undefined> {
  const db = await getDb();
  return db.get('pages', id);
}

export async function createPage(): Promise<Page> {
  const db = await getDb();
  const tx = db.transaction('pages', 'readwrite');
  const existing = await tx.store.getAll();
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.order), -1);
  const now = Date.now();
  const page: Page = {
    id: crypto.randomUUID(),
    title: '',
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    blocks: [{ id: crypto.randomUUID(), type: 'p', text: '' }],
  };
  await tx.store.add(page);
  await tx.done;
  return page;
}

export async function updatePage(
  id: string,
  changes: Partial<Pick<Page, 'title' | 'blocks'>>,
): Promise<Page> {
  const db = await getDb();
  const tx = db.transaction('pages', 'readwrite');
  const page = await tx.store.get(id);
  if (!page) throw new Error(`Page not found: ${id}`);
  const updated: Page = { ...page, ...changes, updatedAt: Date.now() };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('pages', id);
}

/** Set each page's `order` to its position in `ids`, all in one transaction. */
export async function reorderPages(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pages', 'readwrite');
  await Promise.all(
    ids.map(async (id, index) => {
      const page = await tx.store.get(id);
      if (page) await tx.store.put({ ...page, order: index });
    }),
  );
  await tx.done;
}
