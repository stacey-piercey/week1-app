import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';

/**
 * Makes a one-row textarea grow to fit its text, so wrapped lines are never
 * hidden or scrolled. Refits when the text changes and when the window is
 * resized (which changes the wrapping).
 */
export function useFitHeight(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  const fitHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight is 0 where there's no layout (tests); keep 'auto' then.
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [ref]);

  useLayoutEffect(fitHeight, [value, fitHeight]);

  useEffect(() => {
    window.addEventListener('resize', fitHeight);
    return () => window.removeEventListener('resize', fitHeight);
  }, [fitHeight]);
}
