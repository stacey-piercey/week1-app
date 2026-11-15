import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, filterBlockTypes, labelFor } from './blockTypes';

const names = (query: string) => filterBlockTypes(query).map((t) => t.name);

describe('filterBlockTypes', () => {
  it('an empty query lists every type', () => {
    expect(filterBlockTypes('')).toHaveLength(BLOCK_TYPES.length);
  });

  it('matches part of a name, ignoring case', () => {
    expect(names('HEA')).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
    expect(names('list')).toEqual(['Bulleted list', 'Numbered list']);
  });

  it('matches aliases', () => {
    expect(names('todo')).toEqual(['To-do']);
    expect(names('ul')).toEqual(['Bulleted list']);
    expect(names('hr')).toEqual(['Divider']);
  });

  it('returns nothing for nonsense or a leading space', () => {
    expect(names('zzz')).toEqual([]);
    expect(names(' h')).toEqual([]);
  });
});

describe('labelFor', () => {
  it('gives each type its accessible name', () => {
    expect(labelFor('p')).toBe('Paragraph');
    expect(labelFor('bullet')).toBe('Bulleted list item');
  });
});
