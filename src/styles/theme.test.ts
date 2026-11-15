import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';

/** The `--color-*` tokens declared inside the block that starts with `selector {`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in theme.css`);
  const body = css.slice(start, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--(color-[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(match[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = tokens(':root');
const dark = { ...light, ...tokens(":root[data-theme='dark']") };

/** [foreground token, background token, minimum ratio, where it's used] */
const PAIRS: [string, string, number, string][] = [
  // Text: WCAG AA for normal-size text is 4.5:1.
  ['color-text', 'color-bg', 4.5, 'body text'],
  ['color-text', 'color-sidebar-bg', 4.5, 'page names'],
  ['color-text', 'color-hover', 4.5, 'hovered row, slash menu'],
  ['color-text', 'color-selected', 4.5, 'open page row, slash menu highlight'],
  ['color-text', 'color-code-bg', 4.5, 'code block'],
  ['color-muted', 'color-bg', 4.5, 'placeholders, checked to-do, save status'],
  ['color-muted', 'color-sidebar-bg', 4.5, '"+ New page", Untitled'],
  ['color-muted', 'color-hover', 4.5, 'hovered "+ New page" / Untitled'],
  ['color-muted', 'color-selected', 4.5, 'open Untitled page row'],
  ['color-on-danger', 'color-danger', 4.5, 'Delete button'],
  ['color-on-danger', 'color-danger-hover', 4.5, 'Delete button, hovered'],
  // Icons and focus rings: WCAG non-text contrast is 3:1.
  ['color-focus', 'color-bg', 3, 'focus ring in the editor'],
  ['color-focus', 'color-sidebar-bg', 3, 'focus ring in the sidebar'],
  ['color-focus', 'color-selected', 3, 'focus ring on the open page row'],
  ['color-danger-text', 'color-selected', 3, 'trash icon, hovered'],
  ['color-muted', 'color-hover', 3, 'grip and trash icons on a hovered row'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(PAIRS)('%s on %s ≥ %s:1 (%s)', (fg, bg, min) => {
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe('theme tokens', () => {
  it('the dark theme redefines every light colour token', () => {
    expect(Object.keys(tokens(":root[data-theme='dark']")).sort()).toEqual(Object.keys(light).sort());
  });

  it('contrast() matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
