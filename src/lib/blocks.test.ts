import { describe, expect, it } from 'vitest';
import type { Block } from '../types';
import { deleteEmptyBlock, mergeWithPrevious, setBlockText, splitBlock } from './blocks';

const p = (id: string, text: string): Block => ({ id, type: 'p', text });
const texts = (blocks: Block[]) => blocks.map((b) => b.text);

describe('splitBlock', () => {
  it('splits at the cursor and puts the cursor at the start of the new block', () => {
    const result = splitBlock([p('a', 'Hello world')], 'a', 5)!;
    expect(texts(result.blocks)).toEqual(['Hello', ' world']);
    expect(result.blocks[0].id).toBe('a');
    expect(result.blocks[1].id).not.toBe('a');
    expect(result.blocks[1].type).toBe('p');
    expect(result.cursor).toEqual({ id: result.blocks[1].id, offset: 0 });
  });

  it('at the end of the text adds an empty block below', () => {
    const result = splitBlock([p('a', 'Hello')], 'a', 5)!;
    expect(texts(result.blocks)).toEqual(['Hello', '']);
  });

  it('at the start of the text pushes all of it down', () => {
    const result = splitBlock([p('a', 'Hello')], 'a', 0)!;
    expect(texts(result.blocks)).toEqual(['', 'Hello']);
  });

  it('removes selected text before splitting', () => {
    const result = splitBlock([p('a', 'Hello big world')], 'a', 5, 9)!;
    expect(texts(result.blocks)).toEqual(['Hello', ' world']);
  });

  it('inserts the new block right below, keeping the others in order', () => {
    const result = splitBlock([p('a', 'One'), p('b', 'Two'), p('c', 'Three')], 'b', 2)!;
    expect(texts(result.blocks)).toEqual(['One', 'Tw', 'o', 'Three']);
  });

  it('returns null for an unknown block', () => {
    expect(splitBlock([p('a', 'x')], 'nope', 0)).toBeNull();
  });
});

describe('mergeWithPrevious', () => {
  it('joins the text onto the block above, with the cursor at the join', () => {
    const result = mergeWithPrevious([p('a', 'Hello'), p('b', ' world')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hello world']);
    expect(result.blocks[0].id).toBe('a');
    expect(result.cursor).toEqual({ id: 'a', offset: 5 });
  });

  it('merging an empty block removes it, with the cursor at the end of the block above', () => {
    const result = mergeWithPrevious([p('a', 'Hello'), p('b', ''), p('c', 'After')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hello', 'After']);
    expect(result.cursor).toEqual({ id: 'a', offset: 5 });
  });

  it('returns null for the first block', () => {
    expect(mergeWithPrevious([p('a', 'Hello'), p('b', 'x')], 'a')).toBeNull();
  });
});

describe('deleteEmptyBlock', () => {
  it('removes an empty block and moves the cursor to the end of the block above', () => {
    const result = deleteEmptyBlock([p('a', 'Hi'), p('b', '')], 'b')!;
    expect(texts(result.blocks)).toEqual(['Hi']);
    expect(result.cursor).toEqual({ id: 'a', offset: 2 });
  });

  it('removing an empty first block moves the cursor to the start of the next one', () => {
    const result = deleteEmptyBlock([p('a', ''), p('b', 'Next')], 'a')!;
    expect(texts(result.blocks)).toEqual(['Next']);
    expect(result.cursor).toEqual({ id: 'b', offset: 0 });
  });

  it('never deletes the last block', () => {
    expect(deleteEmptyBlock([p('a', '')], 'a')).toBeNull();
  });

  it("doesn't delete a block that has text", () => {
    expect(deleteEmptyBlock([p('a', 'x'), p('b', 'y')], 'b')).toBeNull();
  });
});

describe('setBlockText', () => {
  it('changes only the matching block', () => {
    const blocks = [p('a', 'One'), p('b', 'Two')];
    expect(texts(setBlockText(blocks, 'b', 'Changed'))).toEqual(['One', 'Changed']);
    expect(texts(blocks)).toEqual(['One', 'Two']); // original untouched
  });
});
