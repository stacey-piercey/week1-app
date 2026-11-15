import { useCallback, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import {
  applyShortcut,
  backspaceAtStart,
  insertParagraphAfter,
  isTextBlock,
  listNumbers,
  setBlockText,
  splitBlock,
  toggleChecked,
  type CursorTarget,
  type EditResult,
} from '../lib/blocks';
import { offsetNearX } from '../lib/caret';
import type { Block as BlockData } from '../types';
import Block from './Block';

export interface EditorHandle {
  /** Put the cursor at the start of the first block (Enter in the page title). */
  focusStart: () => void;
}

interface EditorProps {
  blocks: BlockData[];
  onChange: (blocks: BlockData[]) => void;
  ref?: Ref<EditorHandle>;
}

/**
 * The block list. Keys that change the list (Enter, Backspace at the start)
 * go through the pure functions in lib/blocks.ts; this component then puts
 * the cursor where they say, once the new blocks have rendered.
 */
export default function Editor({ blocks, onChange, ref }: EditorProps) {
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  // Where the cursor goes after the next render (set by split/merge/delete).
  const pendingCursor = useRef<CursorTarget | null>(null);

  const registerInput = useCallback((id: string, el: HTMLTextAreaElement | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  }, []);

  const placeCursor = useCallback((target: CursorTarget) => {
    const el = inputs.current.get(target.id);
    if (!el) return;
    el.focus();
    el.setSelectionRange(target.offset, target.offset);
  }, []);

  // Runs after every render: if an edit asked for a cursor move, do it now
  // that the new block exists in the page.
  useLayoutEffect(() => {
    if (pendingCursor.current) {
      placeCursor(pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  useImperativeHandle(
    ref,
    () => ({
      focusStart: () => {
        const first = blocks.find(isTextBlock);
        if (first) placeCursor({ id: first.id, offset: 0 });
      },
    }),
    [blocks, placeCursor],
  );

  const applyEdit = (result: EditResult | null) => {
    if (!result) return;
    pendingCursor.current = result.cursor;
    onChange(result.blocks);
  };

  const handleTextChange = (id: string, text: string, caret: number) => {
    const shortcut = applyShortcut(blocks, id, text, caret);
    if (shortcut) applyEdit(shortcut);
    else onChange(setBlockText(blocks, id, text));
  };

  const handleLeave = (id: string, direction: 'up' | 'down', x: number): boolean => {
    // Step over dividers: they can't take the cursor.
    const step = direction === 'up' ? -1 : 1;
    let i = blocks.findIndex((b) => b.id === id) + step;
    while (blocks[i] && !isTextBlock(blocks[i])) i += step;
    const target = blocks[i];
    const el = target && inputs.current.get(target.id);
    if (!el) return false;
    // Going up lands on the block's last line, going down on its first line.
    const offset = offsetNearX(el, x, direction === 'up' ? 'last' : 'first');
    placeCursor({ id: target.id, offset });
    return true;
  };

  const numbers = listNumbers(blocks);

  return (
    <div className="editor">
      {blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          number={numbers.get(block.id)}
          registerInput={registerInput}
          onTextChange={(text, caret) => handleTextChange(block.id, text, caret)}
          onSplit={(start, end) => applyEdit(splitBlock(blocks, block.id, start, end))}
          onExitCode={() => applyEdit(insertParagraphAfter(blocks, block.id))}
          onBackspaceAtStart={() => applyEdit(backspaceAtStart(blocks, block.id))}
          onToggleChecked={() => onChange(toggleChecked(blocks, block.id))}
          onLeave={(direction, x) => handleLeave(block.id, direction, x)}
        />
      ))}
    </div>
  );
}
