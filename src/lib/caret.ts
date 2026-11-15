/**
 * Cursor geometry for textareas: which visual line the cursor is on, and
 * which character is nearest a given horizontal position.
 *
 * A textarea doesn't report where its text wraps, so we copy its text and
 * styles into a hidden "mirror" div, wrap each character in a <span>, and
 * read each span's position.
 *
 * jsdom (tests) has no layout: every position is 0, so every cursor counts
 * as being on both the first and the last line. Real wrapping can only be
 * checked in a browser (see PLAN.md, Manual checks).
 */

// Styles that affect where text wraps.
const COPIED_STYLES = [
  'box-sizing',
  'width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-indent',
  'tab-size',
  'word-break',
];

interface Point {
  top: number;
  left: number;
}

/** Screen position of every cursor position 0..value.length, relative to the text box. */
function measurePositions(el: HTMLTextAreaElement): Point[] {
  const computed = getComputedStyle(el);
  const mirror = document.createElement('div');
  for (const name of COPIED_STYLES) {
    mirror.style.setProperty(name, computed.getPropertyValue(name));
  }
  mirror.style.width = `${el.offsetWidth}px`;
  mirror.style.boxSizing = 'border-box';
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';

  const text = el.value;
  const spans: HTMLSpanElement[] = new Array(text.length + 1);
  let i = 0;
  while (i < text.length) {
    // Keep emoji and other two-unit characters in one span.
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const span = document.createElement('span');
    span.textContent = char;
    mirror.appendChild(span);
    for (let k = 0; k < char.length; k++) spans[i + k] = span;
    i += char.length;
  }
  // A zero-width marker for the position after the last character.
  const end = document.createElement('span');
  end.textContent = '​';
  mirror.appendChild(end);
  spans[text.length] = end;

  document.body.appendChild(mirror);
  const points = spans.map((s) => ({ top: s.offsetTop, left: s.offsetLeft }));
  mirror.remove();
  return points;
}

// Spans on one line can differ by a pixel or so; lines are much further apart.
const sameLine = (a: Point, b: Point) => Math.abs(a.top - b.top) < 2;

export interface CaretInfo {
  onFirstLine: boolean;
  onLastLine: boolean;
  /** Horizontal position of the cursor, in pixels from the text box's left edge. */
  x: number;
}

export function caretInfo(el: HTMLTextAreaElement): CaretInfo {
  const points = measurePositions(el);
  const here = points[el.selectionStart];
  return {
    onFirstLine: sameLine(here, points[0]),
    onLastLine: sameLine(here, points[points.length - 1]),
    x: here.left,
  };
}

/**
 * The cursor position on the textarea's first or last visual line that's
 * closest to `x`. Used so Up/Down between blocks keep roughly the same
 * horizontal position.
 */
export function offsetNearX(el: HTMLTextAreaElement, x: number, line: 'first' | 'last'): number {
  const points = measurePositions(el);
  const lineRef = line === 'first' ? points[0] : points[points.length - 1];
  let best = -1;
  let bestDistance = Infinity;
  points.forEach((point, offset) => {
    if (!sameLine(point, lineRef)) return;
    const distance = Math.abs(point.left - x);
    if (distance < bestDistance) {
      best = offset;
      bestDistance = distance;
    }
  });
  return best === -1 ? 0 : best;
}
