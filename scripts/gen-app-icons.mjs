// Builds the PNG app icons from the master sprout (ideas/app-icon.md). Run: node scripts/gen-app-icons.mjs
// Uses sharp, which Next.js already installs for next/image.
//
// - icon-{192,512,1024}.png, purpose "any" (Chrome/Edge desktop install, macOS Dock, Windows taskbar):
//   a transparent canvas with the peach tile on the macOS icon grid (824 of 1024 px, 100 px margin,
//   corner radius 185 px) and a soft shadow, so it sits like a native icon. No drawn edge: the OS
//   draws the tile's outline itself, and an edge inside a padded tile looked like a box in a box.
// - logo-192.png: the full-bleed tile, for the pictures inside the app (landing, sign-in, invite,
//   notifications), where CSS rounds the corners.
// - maskable-512.png (Android) and app/apple-icon.png (iOS) are full-bleed and stay as they are.
import sharp from "sharp";

const SPROUT = `
  <path d="M20 51 L44 51" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 51 C33 44 31 38 33 29" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 38 C22 38 16 32 14 23 C23 22 30 28 31 38 Z" fill="#B84F33"/>
  <path d="M33 31 C33 21 39 14 50 13 C51 23 44 30 33 31 Z" fill="#B84F33"/>`;

// The tile on the macOS grid, drawn on a 1024 canvas; the sprout's 64-unit art fills the tile.
const padded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><filter id="s" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#5A2A1A" flood-opacity="0.22"/>
  </filter></defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#FDE3D3" filter="url(#s)"/>
  <g transform="translate(100 100) scale(${824 / 64})">${SPROUT}</g>
</svg>`;

const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#FDE3D3"/>${SPROUT}
</svg>`;

const out = "public/icons";
for (const size of [192, 512, 1024]) {
  await sharp(Buffer.from(padded), { density: (72 * size) / 1024 * 4 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${out}/icon-${size}.png`);
}
await sharp(Buffer.from(fullBleed), { density: 72 * 12 }).resize(192, 192).png({ compressionLevel: 9 }).toFile(`${out}/logo-192.png`);
console.log("icons written to", out);
