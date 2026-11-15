import { useCallback, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { deleteEmptyBlock, mergeWithPrevious, setBlockText, splitBlock, type CursorTarget, type EditResult } from '../lib/blocks';
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
        if (blocks[0]) placeCursor({ id: blocks[0].id, offset: 0 });
      },
    }),
    [blocks, placeCursor],
  );

  const applyEdit = (result: EditResult | null) => {
    if (!result) return;
    pendingCursor.current = result.cursor;
    onChange(result.blocks);
  };

  const handleLeave = (id: string, direction: 'up' | 'down', x: number): boolean => {
    const index = blocks.findIndex((b) => b.id === id);
    const target = blocks[direction === 'up' ? index - 1 : index + 1];
    const el = target && inputs.current.get(target.id);
    if (!el) return false;
    // Going up lands on the block's last line, going down on its first line.
    const offset = offsetNearX(el, x, direction === 'up' ? 'last' : 'first');
    placeCursor({ id: target.id, offset });
    return true;
  };

  return (
    <div className="editor">
      {blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          registerInput={registerInput}
          onTextChange={(text) => onChange(setBlockText(blocks, block.id, text))}
          onSplit={(start, end) => applyEdit(splitBlock(blocks, block.id, start, end))}
          onBackspaceAtStart={() =>
            applyEdit(mergeWithPrevious(blocks, block.id) ?? deleteEmptyBlock(blocks, block.id))
          }
          onLeave={(direction, x) => handleLeave(block.id, direction, x)}
        />
      ))}
    </div>
  );
}
