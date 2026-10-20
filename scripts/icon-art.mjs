// The master app icon (docs/design.md "App icon"): a cream sprout on a terracotta gradient tile.
// Every icon file is drawn from here (scripts/gen-app-icons.mjs, scripts/gen-ios-splash.mjs); the art is
// in 64-unit space, as app/icon.svg.

export const COLORS = { top: "#C85A3A", bottom: "#A3401F", sprout: "#FFF3E8", flat: "#B84F33" };

// The sprout's bounding box is x 14–50, y 13–53.5; scaling about its middle (32, 33.25) and placing
// that at the tile's centre keeps the margins even.
const MIDDLE = 33.25;

export function sproutPaths(color = COLORS.sprout) {
  return `<path d="M20 51 L44 51" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 51 C33 44 31 38 33 29" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 38 C22 38 16 32 14 23 C23 22 30 28 31 38 Z" fill="${color}"/>
  <path d="M33 31 C33 21 39 14 50 13 C51 23 44 30 33 31 Z" fill="${color}"/>`;
}

// The sprout at `scale`, centred on the 64-unit tile.
export function sprout(scale, color) {
  return `<g transform="translate(32 32) scale(${scale}) translate(-32 -${MIDDLE})">${sproutPaths(color)}</g>`;
}

export const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.top}"/><stop offset="1" stop-color="${COLORS.bottom}"/></linearGradient>`;

// The tile's content in 64 units: the gradient square (rx rounds it; 0 is full bleed) and the sprout.
// flat: one colour instead of the gradient (the 16 px favicon, where a gradient only muddies it).
export function tileArt({ rx = 0, scale = 1.32, flat = false } = {}) {
  return `<rect width="64" height="64" rx="${rx}" fill="${flat ? COLORS.flat : "url(#g)"}"/>${sprout(scale)}`;
}

export function tileSvg(opts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENT}</defs>
  ${tileArt(opts)}
</svg>
`;
}
