// Builds every app icon from the master tile (scripts/icon-art.mjs, docs/design.md "App icon").
// Run: node scripts/gen-app-icons.mjs. Uses sharp, which Next.js already installs for next/image;
// compressPng (scripts/compress-images.mjs) shrinks the output.
//
// - app/icon.svg (browser tab, README) and app/favicon.ico (16, 32, 48): the tile with rounded corners,
//   since a tab shows it unmasked. At 16 px the tile is one flat colour.
// - app/apple-icon.png (180, iOS) and public/icons/logo-192.png (the pictures inside the app: landing,
//   sign-in, invite, notifications; CSS rounds them): full bleed and opaque, the OS or CSS rounds them.
// - public/icons/maskable-512.png (Android): full bleed, the sprout smaller so it stays in the safe zone
//   (the middle 80% circle).
// - public/icons/icon-{192,512,1024}.png, purpose "any" (Chrome/Edge desktop install, macOS Dock, Windows
//   taskbar): a transparent canvas with the tile on the macOS icon grid (824 of 1024 px, 100 px margin,
//   corner radius 185 px) and a soft shadow, so it sits like a native icon.
// - public/icons/badge-96.png: the push notification badge (Android draws it from the alpha channel
//   only): the sprout in white on transparent.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { compressPng } from "./compress-images.mjs";
import { GRADIENT, sprout, tileSvg } from "./icon-art.mjs";

const MASKABLE_SCALE = 0.88; // the sprout's farthest point at about 23.7 of the safe zone's 25.6 units (measured: 189 of 204.8 px)

// An SVG drawn in 64 units, as a PNG of `size` px (rendered at 4× and scaled down for clean edges).
const render = (svg, size) => sharp(Buffer.from(svg), { density: ((72 * size) / 64) * 4 }).resize(size, size);

const padded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>${GRADIENT}<filter id="s" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#5A2A1A" flood-opacity="0.22"/>
  </filter></defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)" filter="url(#s)"/>
  <g transform="translate(100 100) scale(${824 / 64})">${sprout(1.32)}</g>
</svg>`;

// A .ico of PNG images (Vista+ and every browser read PNG entries): header, one entry per image, the PNGs.
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size % 256, e); // width, 0 means 256
    header.writeUInt8(size % 256, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const png = async (svg, size, opaque = false) => {
  const img = render(svg, size);
  return compressPng(await (opaque ? img.flatten() : img).png().toBuffer());
};

writeFileSync("app/icon.svg", tileSvg({ rx: 14 }));
writeFileSync("app/apple-icon.png", await png(tileSvg(), 180, true)); // iOS fills alpha with black
writeFileSync("public/icons/logo-192.png", await png(tileSvg(), 192, true));
writeFileSync("public/icons/maskable-512.png", await png(tileSvg({ scale: MASKABLE_SCALE }), 512, true));
for (const size of [192, 512, 1024]) {
  const img = await sharp(Buffer.from(padded), { density: ((72 * size) / 1024) * 4 }).resize(size, size).png().toBuffer();
  writeFileSync(`public/icons/icon-${size}.png`, await compressPng(img));
}
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${sprout(1.45, "#FFFFFF")}</svg>`;
writeFileSync("public/icons/badge-96.png", await png(badge, 96));
const favicon = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    data: await png(tileSvg({ rx: 14, ...(size === 16 && { flat: true }) }), size),
  })),
);
writeFileSync("app/favicon.ico", ico(favicon));
console.log("icons written to app/ and public/icons/");
