import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDb,
  createPage,
  deletePage,
  getPage,
  listPages,
  reorderPages,
  updatePage,
} from './storage';

beforeEach(() => {
  // A brand-new, empty fake database for every test.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('createPage returns a page with an id and one empty paragraph', async () => {
    const page = await createPage();
    expect(page.id).toEqual(expect.any(String));
    expect(page.id.length).toBeGreaterThan(0);
    expect(page.title).toBe('');
    expect(page.blocks).toHaveLength(1);
    expect(page.blocks[0]).toMatchObject({ type: 'p', text: '' });
  });

  it('listPages is sorted by order', async () => {
    const a = await createPage();
    const b = await createPage();
    const c = await createPage();
    // Shuffle the stored order so insertion order and `order` differ.
    await reorderPages([c.id, a.id, b.id]);
    const ids = (await listPages()).map((p) => p.id);
    expect(ids).toEqual([c.id, a.id, b.id]);
  });

  it('updatePage changes updatedAt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const page = await createPage();
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const updated = await updatePage(page.id, { title: 'Hello' });
    expect(updated.updatedAt).toBe(2000);
    expect(updated.createdAt).toBe(1000);
    expect((await getPage(page.id))?.title).toBe('Hello');
  });

  it('deletePage removes the page', async () => {
    const a = await createPage();
    const b = await createPage();
    await deletePage(a.id);
    expect(await getPage(a.id)).toBeUndefined();
    expect((await listPages()).map((p) => p.id)).toEqual([b.id]);
  });

  it('reorderPages rewrites order', async () => {
    const a = await createPage();
    const b = await createPage();
    await reorderPages([b.id, a.id]);
    expect((await getPage(b.id))?.order).toBe(0);
    expect((await getPage(a.id))?.order).toBe(1);
  });

  it('data survives reopening the database', async () => {
    const page = await createPage();
    await updatePage(page.id, { title: 'Kept' });
    await closeDb();
    const reopened = await getPage(page.id);
    expect(reopened?.title).toBe('Kept');
  });

  it('getPage returns undefined for an unknown id', async () => {
    expect(await getPage('nope')).toBeUndefined();
  });
});
