import { useCallback, useRef, type KeyboardEvent } from 'react';
import { useFitHeight } from '../hooks/useFitHeight';
import { caretInfo } from '../lib/caret';
import type { Block as BlockData } from '../types';

export interface BlockProps {
  block: BlockData;
  /** Lets the editor reach this block's textarea to move focus into it. */
  registerInput: (id: string, el: HTMLTextAreaElement | null) => void;
  onTextChange: (text: string) => void;
  /** Enter: split at the cursor (or replace the selection). */
  onSplit: (start: number, end: number) => void;
  /** Backspace with the cursor at the very start and nothing selected. */
  onBackspaceAtStart: () => void;
  /**
   * Up on the first line or Down on the last line. Returns false if there's
   * no block in that direction, so the browser's normal behaviour runs.
   */
  onLeave: (direction: 'up' | 'down', x: number) => boolean;
}

/** One paragraph: a one-row textarea that grows to fit, like the page title. */
export default function Block({ block, registerInput, onTextChange, onSplit, onBackspaceAtStart, onLeave }: BlockProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useFitHeight(ref, block.text);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el;
      registerInput(block.id, el);
    },
    [block.id, registerInput],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Ignore keys while an IME (e.g. Japanese input) is composing.
    if (e.nativeEvent.isComposing) return;
    const modified = e.altKey || e.ctrlKey || e.metaKey;
    const collapsed = el.selectionStart === el.selectionEnd;

    // Shift+Enter is left alone: the textarea inserts a line break.
    if (e.key === 'Enter' && !e.shiftKey && !modified) {
      e.preventDefault();
      onSplit(el.selectionStart, el.selectionEnd);
      return;
    }

    if (e.key === 'Backspace' && !modified && collapsed && el.selectionStart === 0) {
      e.preventDefault();
      onBackspaceAtStart();
      return;
    }

    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !modified && collapsed) {
      const caret = caretInfo(el);
      const up = e.key === 'ArrowUp';
      // Only leave the block from its first line (Up) or last line (Down).
      // Otherwise the browser moves the cursor one line within the block.
      if ((up ? caret.onFirstLine : caret.onLastLine) && onLeave(up ? 'up' : 'down', caret.x)) {
        e.preventDefault();
      }
    }
  };

  return (
    <textarea
      ref={setRef}
      className="block-input"
      rows={1}
      aria-label="Paragraph"
      value={block.text}
      onChange={(e) => onTextChange(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
