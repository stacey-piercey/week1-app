import { vi } from 'vitest';

/**
 * jsdom has no layout, so every element measures 0×0. This stacks the
 * sidebar rows 32 px apart, in DOM order, so dnd-kit's keyboard moves can
 * find the row above or below. Undone by `vi.restoreAllMocks()` after
 * each test (see setup.ts).
 */
export function stackRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rows = Array.from(document.querySelectorAll('.page-row'));
    const index = rows.indexOf(this);
    const top = index === -1 ? 0 : index * 32;
    const height = index === -1 ? 0 : 32;
    const width = index === -1 ? 0 : 220;
    return {
      x: 0,
      y: top,
      top,
      left: 0,
      width,
      height,
      right: width,
      bottom: top + height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}
