import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as storage from '../lib/storage';
import { createPage, listPages, updatePage } from '../lib/storage';
import { usePages } from './usePages';

/** Three saved pages, A, B and C, then the hook loaded with them. */
async function setup() {
  for (const title of ['A', 'B', 'C']) {
    const page = await createPage();
    await updatePage(page.id, { title });
  }
  const hook = renderHook(() => usePages());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

const titles = (list: { title: string }[]) => list.map((p) => p.title);

describe('usePages.reorderPage', () => {
  it('moves the page in memory and saves the new order', async () => {
    const { result } = await setup();
    const [a, , c] = result.current.pages;

    await act(() => result.current.reorderPage(a.id, c.id));

    expect(titles(result.current.pages)).toEqual(['B', 'C', 'A']);
    expect(titles(await listPages())).toEqual(['B', 'C', 'A']);
  });

  it('puts the old order back if the save fails', async () => {
    const { result } = await setup();
    const [a, , c] = result.current.pages;
    vi.spyOn(storage, 'reorderPages').mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let ok = true;
    await act(async () => {
      ok = await result.current.reorderPage(a.id, c.id);
    });

    expect(ok).toBe(false);
    expect(titles(result.current.pages)).toEqual(['A', 'B', 'C']);
    expect(titles(await listPages())).toEqual(['A', 'B', 'C']);
  });

  it('does nothing when a page is dropped on itself', async () => {
    const { result } = await setup();
    const before = result.current.pages;
    const spy = vi.spyOn(storage, 'reorderPages');

    await act(() => result.current.reorderPage(before[1].id, before[1].id));

    expect(result.current.pages).toBe(before);
    expect(spy).not.toHaveBeenCalled();
  });
});
