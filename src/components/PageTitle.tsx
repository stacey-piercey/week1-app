import { useEffect, useRef } from 'react';
import { useFitHeight } from '../hooks/useFitHeight';

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
  useFitHeight(ref, value);

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
