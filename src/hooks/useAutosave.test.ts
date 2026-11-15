import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave, type SaveFn } from './useAutosave';

// Fake only the timers the hook uses, so promises (and fake-indexeddb) still work.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advance fake time and let any saves it triggers finish. */
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function setup(save: SaveFn = vi.fn().mockResolvedValue(undefined)) {
  const view = renderHook(() => useAutosave(save));
  const type = (title: string) => act(() => view.result.current.schedule('page-1', { title }));
  return { ...view, save: save as ReturnType<typeof vi.fn>, type };
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useAutosave', () => {
  afterEach(() => {
    // Remove the test's override so the real getter applies again.
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it('waits 500 ms after typing before saving', async () => {
    const { save, type } = setup();
    type('Hello');

    await wait(499);
    expect(save).not.toHaveBeenCalled();

    await wait(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('page-1', { title: 'Hello' });
  });

  it('typing again restarts the timer and the save has the latest text', async () => {
    const { save, type } = setup();
    type('Hel');
    await wait(300);
    type('Hello');
    await wait(300);
    expect(save).not.toHaveBeenCalled();

    await wait(200);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('page-1', { title: 'Hello' });
  });

  it.each([
    ['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
    ['beforeunload', () => window.dispatchEvent(new Event('beforeunload'))],
    ['visibilitychange (hidden)', () => setVisibility('hidden')],
  ])('saves at once on %s', async (_name, leave) => {
    const { save, type } = setup();
    type('Hello');
    await wait(100);

    await act(async () => leave());

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('page-1', { title: 'Hello' });
    // The cancelled timer doesn't save a second time.
    await wait(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save early when the tab becomes visible', async () => {
    const { save, type } = setup();
    type('Hello');
    await act(async () => setVisibility('visible'));
    expect(save).not.toHaveBeenCalled();
  });

  it('does nothing on close when there is nothing to save', async () => {
    const { save } = setup();
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves unsaved edits on unmount', async () => {
    const { save, type, unmount } = setup();
    type('Hello');
    await act(async () => unmount());
    expect(save).toHaveBeenCalledWith('page-1', { title: 'Hello' });
  });

  it('status goes idle, then Saving, then Saved', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result, type } = setup(save);
    expect(result.current.status).toBe('idle');

    type('Hello');
    expect(result.current.status).toBe('saving');

    await wait(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saving');

    await act(async () => finish());
    expect(result.current.status).toBe('saved');
  });

  it('a failed save shows an error and the next edit retries', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, type } = setup(save);

    type('Hello');
    await wait(500);
    expect(result.current.status).toBe('error');

    type('Hello!');
    await wait(500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('page-1', { title: 'Hello!' });
    expect(result.current.status).toBe('saved');
  });

  it('a retry keeps failed changes that were not edited again', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup(save);
    const blocks = [{ id: 'b1', type: 'p' as const, text: 'Body' }];

    act(() => result.current.schedule('page-1', { title: 'Hello', blocks }));
    await wait(500);
    act(() => result.current.schedule('page-1', { title: 'Hello!' }));
    await wait(500);

    expect(save).toHaveBeenLastCalledWith('page-1', { title: 'Hello!', blocks });
  });

  it('saves one at a time, in order', async () => {
    const calls: string[] = [];
    let finishFirst!: () => void;
    const save = vi.fn((_id: string, changes: { title?: string }) => {
      calls.push(changes.title ?? '');
      return calls.length === 1 ? new Promise<void>((r) => (finishFirst = r)) : Promise.resolve();
    });
    const { result, type } = setup(save);

    type('First');
    await act(async () => {
      void result.current.flush();
    });
    expect(calls).toEqual(['First']);
    type('Second');
    await act(async () => {
      void result.current.flush();
    });
    // The second save waits for the first to finish.
    expect(calls).toEqual(['First']);

    await act(async () => finishFirst());
    expect(calls).toEqual(['First', 'Second']);
    expect(result.current.status).toBe('saved');
  });

  it('saves edits to two pages separately', async () => {
    const { result, save } = setup();
    act(() => {
      result.current.schedule('page-1', { title: 'One' });
      result.current.schedule('page-2', { title: 'Two' });
    });
    await act(() => result.current.flush());
    expect(save).toHaveBeenCalledWith('page-1', { title: 'One' });
    expect(save).toHaveBeenCalledWith('page-2', { title: 'Two' });
  });
});
