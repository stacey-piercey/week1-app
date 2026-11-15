/**
 * jsdom has no window.matchMedia. This stand-in answers only the
 * "prefers-color-scheme: dark" question, and lets a test flip the
 * system setting as if Windows switched between light and dark.
 */
type Listener = (event: MediaQueryListEvent) => void;

let systemDark = false;
const listeners = new Set<Listener>();

function fakeMatchMedia(query: string): MediaQueryList {
  const isDarkQuery = query.includes('prefers-color-scheme: dark');
  return {
    media: query,
    get matches() {
      return isDarkQuery && systemDark;
    },
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      if (isDarkQuery) listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
}

/** Called from setup.ts before every test: system theme is light. */
export function installMatchMedia() {
  systemDark = false;
  listeners.clear();
  window.matchMedia = fakeMatchMedia;
}

/** Pretend the operating system switched to dark (true) or light (false). */
export function setSystemDark(dark: boolean) {
  systemDark = dark;
  for (const listener of listeners) {
    listener({ matches: dark, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent);
  }
}
