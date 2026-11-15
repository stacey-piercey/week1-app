import { useEffect } from 'react';
import type { BlockTypeInfo } from '../lib/blockTypes';
import type { BlockType } from '../types';

interface SlashMenuProps {
  /** Used for the list and option ids, which the textarea points at. */
  id: string;
  options: BlockTypeInfo[];
  /** Index of the highlighted option. */
  active: number;
  onPick: (type: BlockType) => void;
}

export const optionId = (menuId: string, index: number) => `${menuId}-option-${index}`;

/**
 * The list of block types shown after "/". It only displays; the keys
 * (arrows, Enter, Escape) are handled by the block's textarea, which keeps
 * focus the whole time so typing keeps filtering.
 */
export default function SlashMenu({ id, options, active, onPick }: SlashMenuProps) {
  // Keep the highlighted option visible when the list scrolls.
  useEffect(() => {
    document.getElementById(optionId(id, active))?.scrollIntoView?.({ block: 'nearest' });
  }, [id, active]);

  return (
    <ul id={id} role="listbox" aria-label="Block types" className="slash-menu">
      {options.map((option, i) => (
        <li
          key={option.type}
          id={optionId(id, i)}
          role="option"
          aria-selected={i === active}
          className="slash-option"
          // Stop the click from taking focus away from the textarea.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(option.type)}
        >
          {option.name}
        </li>
      ))}
    </ul>
  );
}
