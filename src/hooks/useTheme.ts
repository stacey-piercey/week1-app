import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key. index.html reads the same key before the first paint. */
export const THEME_KEY = 'notes.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The toggle's cycle: System → Light → Dark → System. */
const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

// localStorage can throw (private mode, blocked storage). If it does,
// the app uses System and just doesn't remember the choice.
function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function saveMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

function systemIsDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * The colour theme. `mode` is what you picked; `resolved` is what's shown
 * (System follows the operating system, live). Sets `data-theme` on <html>,
 * which switches the colour tokens in theme.css.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const [systemDark, setSystemDark] = useState(systemIsDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  // Before paint, so the colours never show the old theme for a frame.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const cycle = useCallback(() => {
    const next = NEXT[mode];
    setMode(next);
    saveMode(next);
  }, [mode]);

  return { mode, resolved, cycle };
}
