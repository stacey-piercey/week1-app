import { useCallback, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useFitHeight } from '../hooks/useFitHeight';
import { filterBlockTypes, labelFor } from '../lib/blockTypes';
import { caretInfo } from '../lib/caret';
import type { Block as BlockData, BlockType } from '../types';
import SlashMenu, { optionId } from './SlashMenu';

/** An open slash menu: where the "/" is, what's typed after it, which option is highlighted. */
interface SlashState {
  start: number;
  query: string;
  active: number;
}

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
  /** A slash-menu choice: remove text from..to (the "/query") and change the type. */
  onPickType: (type: BlockType, from: number, to: number) => void;
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
  onPickType,
  onLeave,
}: BlockProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useFitHeight(ref, block.text);
  const menuId = useId();
  const [slash, setSlash] = useState<SlashState | null>(null);
  const options = slash ? filterBlockTypes(slash.query) : [];

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

  /**
   * Open, filter or close the slash menu after the text changes. It opens
   * when "/" is typed at the start of the block or after a space, and
   * closes when the "/" is gone, the cursor is before it, or nothing matches.
   */
  const updateSlash = (text: string, caret: number) => {
    const typedSlash =
      text.length === block.text.length + 1 &&
      text[caret - 1] === '/' &&
      (caret === 1 || /\s/.test(text[caret - 2]));
    if (typedSlash) {
      setSlash({ start: caret - 1, query: '', active: 0 });
      return;
    }
    if (!slash) return;
    const query = text.slice(slash.start + 1, caret);
    if (text[slash.start] !== '/' || caret <= slash.start || filterBlockTypes(query).length === 0) {
      setSlash(null);
      return;
    }
    setSlash({ ...slash, query, active: 0 });
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = e.target;
    updateSlash(value, selectionStart);
    onTextChange(value, selectionStart);
  };

  const pick = (type: BlockType) => {
    if (!slash) return;
    setSlash(null);
    onPickType(type, slash.start, slash.start + 1 + slash.query.length);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Ignore keys while an IME (e.g. Japanese input) is composing.
    if (e.nativeEvent.isComposing) return;
    const modified = e.altKey || e.ctrlKey || e.metaKey;
    const collapsed = el.selectionStart === el.selectionEnd;

    // While the slash menu is open, arrows, Enter and Escape drive the menu.
    if (slash && options.length > 0) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey && !modified) {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setSlash({ ...slash, active: (slash.active + step + options.length) % options.length });
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !modified) {
        e.preventDefault();
        pick(options[slash.active].type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

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

  const menuOpen = slash !== null && options.length > 0;

  return (
    <div className={`block block-${block.type}${block.checked ? ' is-checked' : ''}`}>
      {marker}
      <textarea
        ref={setRef}
        className="block-input"
        rows={1}
        aria-label={labelFor(block.type)}
        aria-autocomplete={menuOpen ? 'list' : undefined}
        aria-controls={menuOpen ? menuId : undefined}
        aria-activedescendant={menuOpen ? optionId(menuId, slash.active) : undefined}
        value={block.text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // Moving the cursor before the "/" (click, Left arrow, Home) closes the menu.
        onSelect={(e) => {
          if (slash && e.currentTarget.selectionStart <= slash.start) setSlash(null);
        }}
        onBlur={() => setSlash(null)}
      />
      {menuOpen && <SlashMenu id={menuId} options={options} active={slash.active} onPick={pick} />}
    </div>
  );
}
