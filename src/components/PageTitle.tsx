import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface PageTitleProps {
  value: string;
  onChange: (title: string) => void;
  onEnter: () => void;
  autoFocus?: boolean;
}

/**
 * Editable page title. A one-row textarea (so long titles wrap) that grows
 * to fit its text. It stays a single paragraph: Enter is caught, and pasted
 * line breaks become spaces.
 */
export default function PageTitle({ value, onChange, onEnter, autoFocus = false }: PageTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fitHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight is 0 where there's no layout (tests); keep 'auto' then.
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Refit when the text changes...
  useLayoutEffect(fitHeight, [value, fitHeight]);

  // ...and when the window width changes, since that changes the wrapping.
  useEffect(() => {
    window.addEventListener('resize', fitHeight);
    return () => window.removeEventListener('resize', fitHeight);
  }, [fitHeight]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <h1 className="page-title">
      <textarea
        ref={ref}
        className="page-title-input"
        rows={1}
        aria-label="Page title"
        placeholder="Untitled"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
        onKeyDown={(e) => {
          // Ignore Enter while an IME (e.g. Japanese input) is composing.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </h1>
  );
}
