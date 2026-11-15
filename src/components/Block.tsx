import { useCallback, useRef, type KeyboardEvent } from 'react';
import { useFitHeight } from '../hooks/useFitHeight';
import { labelFor } from '../lib/blockTypes';
import { caretInfo } from '../lib/caret';
import type { Block as BlockData } from '../types';

export interface BlockProps {
  block: BlockData;
  /** Position in a numbered list (numbered blocks only). */
  number?: number;
  /** Lets the editor reach this block's textarea to move focus into it. */
  registerInput: (id: string, el: HTMLTextAreaElement | null) => void;
  /** New text, plus where the cursor is (so markdown shortcuts can be spotted). */
  onTextChange: (text: string, caret: number) => void;
  /** Enter: split at the cursor (or replace the selection). */
  onSplit: (start: number, end: number) => void;
  /** Ctrl+Enter in a code block: start a paragraph below. */
  onExitCode: () => void;
  /** Backspace with the cursor at the very start and nothing selected. */
  onBackspaceAtStart: () => void;
  /** The to-do checkbox was clicked. */
  onToggleChecked: () => void;
  /**
   * Up on the first line or Down on the last line. Returns false if there's
   * no block in that direction, so the browser's normal behaviour runs.
   */
  onLeave: (direction: 'up' | 'down', x: number) => boolean;
}

/**
 * One block. Text blocks are a one-row textarea that grows to fit (like the
 * page title), with a bullet, number or checkbox in front for lists. A
 * divider is just a line.
 */
export default function Block({
  block,
  number,
  registerInput,
  onTextChange,
  onSplit,
  onExitCode,
  onBackspaceAtStart,
  onToggleChecked,
  onLeave,
}: BlockProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useFitHeight(ref, block.text);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el;
      registerInput(block.id, el);
    },
    [block.id, registerInput],
  );

  if (block.type === 'divider') {
    return (
      <div className="block block-divider">
        <hr />
      </div>
    );
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Ignore keys while an IME (e.g. Japanese input) is composing.
    if (e.nativeEvent.isComposing) return;
    const modified = e.altKey || e.ctrlKey || e.metaKey;
    const collapsed = el.selectionStart === el.selectionEnd;

    if (e.key === 'Enter' && block.type === 'code') {
      // Plain Enter adds a newline in code. Ctrl+Enter leaves the block.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onExitCode();
      }
      return;
    }

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

  // The marker slot is always rendered (even as null) so the textarea keeps
  // its place and isn't re-created when the type changes.
  let marker = null;
  if (block.type === 'bullet') {
    marker = (
      <span className="block-marker" aria-hidden="true">
        •
      </span>
    );
  } else if (block.type === 'number') {
    marker = (
      <span className="block-marker" aria-hidden="true">
        {number ?? 1}.
      </span>
    );
  } else if (block.type === 'todo') {
    marker = (
      <span className="block-marker">
        <input type="checkbox" aria-label="Done" checked={!!block.checked} onChange={onToggleChecked} />
      </span>
    );
  }

  return (
    <div className={`block block-${block.type}${block.checked ? ' is-checked' : ''}`}>
      {marker}
      <textarea
        ref={setRef}
        className="block-input"
        rows={1}
        aria-label={labelFor(block.type)}
        value={block.text}
        onChange={(e) => onTextChange(e.target.value, e.target.selectionStart)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
