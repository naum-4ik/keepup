// Builds the iPhone launch screens (apple-touch-startup-image) listed in lib/ios-splash.json, one per screen
// size, into public/splash/. Run: node scripts/gen-ios-splash.mjs. Uses sharp (Next.js already installs it).
// The picture: the page's cream (#FFF8F0, the manifest's background_color) with the app tile in the middle,
// as Android's launch screen shows the icon on background_color. The tile is drawn as in
// scripts/gen-app-icons.mjs (the master sprout, docs/design.md "App icon"), 30% of the screen's width.
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const screens = JSON.parse(readFileSync(new URL("../lib/ios-splash.json", import.meta.url), "utf8"));

const SPROUT = `
  <path d="M20 51 L44 51" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 51 C33 44 31 38 33 29" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 38 C22 38 16 32 14 23 C23 22 30 28 31 38 Z" fill="#B84F33"/>
  <path d="M33 31 C33 21 39 14 50 13 C51 23 44 30 33 31 Z" fill="#B84F33"/>`;

function splash(w, h) {
  const tile = Math.round(w * 0.3);
  const x = (w - tile) / 2;
  const y = (h - tile) / 2;
  const radius = tile * (185 / 824); // the installed icon's corner, on the macOS grid
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><filter id="s" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="${tile * 0.012}" stdDeviation="${tile * 0.015}" flood-color="#5A2A1A" flood-opacity="0.18"/>
  </filter></defs>
  <rect width="${w}" height="${h}" fill="#FFF8F0"/>
  <rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${radius}" fill="#FDE3D3" filter="url(#s)"/>
  <g transform="translate(${x} ${y}) scale(${tile / 64})">${SPROUT}</g>
</svg>`;
}

const out = "public/splash";
mkdirSync(out, { recursive: true });
const done = new Set();
for (const { width, height, ratio } of screens) {
  const [w, h] = [width * ratio, height * ratio];
  if (done.has(`${w}x${h}`)) continue;
  done.add(`${w}x${h}`);
  await sharp(Buffer.from(splash(w, h))).png({ compressionLevel: 9, palette: true }).toFile(`${out}/iphone-${w}x${h}.png`);
}
console.log(`${done.size} launch screens written to ${out}`);
