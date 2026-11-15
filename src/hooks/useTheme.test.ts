import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setSystemDark } from '../test/matchMedia';
import { THEME_KEY, useTheme } from './useTheme';

const htmlTheme = () => document.documentElement.dataset.theme;

describe('useTheme', () => {
  it('starts on System and follows a light system', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
    expect(result.current.resolved).toBe('light');
    expect(htmlTheme()).toBe('light');
  });

  it('starts dark on System when the system is dark', () => {
    setSystemDark(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('dark');
    expect(htmlTheme()).toBe('dark');
  });

  it('cycles System → Light → Dark → System', () => {
    const { result } = renderHook(() => useTheme());
    const modes = [result.current.mode];
    for (let i = 0; i < 3; i++) {
      act(() => result.current.cycle());
      modes.push(result.current.mode);
    }
    expect(modes).toEqual(['system', 'light', 'dark', 'system']);
  });

  it('saves the choice and reads it back next time', () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.cycle()); // light
    act(() => first.result.current.cycle()); // dark
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    first.unmount();

    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(htmlTheme()).toBe('dark');
  });

  it('in System mode, follows the system when it changes', () => {
    const { result } = renderHook(() => useTheme());
    act(() => setSystemDark(true));
    expect(result.current.resolved).toBe('dark');
    expect(htmlTheme()).toBe('dark');
    act(() => setSystemDark(false));
    expect(htmlTheme()).toBe('light');
  });

  it('in Light or Dark mode, ignores system changes', () => {
    localStorage.setItem(THEME_KEY, 'light');
    renderHook(() => useTheme());
    act(() => setSystemDark(true));
    expect(htmlTheme()).toBe('light');
  });

  it('treats an unknown saved value as System', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });

  it('falls back to System if localStorage throws, and still cycles', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
    act(() => result.current.cycle());
    expect(result.current.mode).toBe('light');
    expect(htmlTheme()).toBe('light');
  });
});
