// WCAG 2.2 contrast (docs/design.md "Contrast"): relative luminance of sRGB hex colours, the ratio
// between two, and an alpha mix for tints like `bg-destructive/10` over a card. Used by the token test.

type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// `top` at `alpha` (0–1) over an opaque `bottom`, as the browser composites it (in sRGB).
export function mix(top: string, alpha: number, bottom: string): string {
  const t = parseHex(top);
  const b = parseHex(bottom);
  return toHex(t.map((c, i) => c * alpha + b[i] * (1 - alpha)) as Rgb);
}
