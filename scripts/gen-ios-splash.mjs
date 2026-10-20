// Builds the iPhone launch screens (apple-touch-startup-image) listed in lib/ios-splash.json, one per screen
// size, into public/splash/. Run: node scripts/gen-ios-splash.mjs. Uses sharp (Next.js already installs it).
// The picture: the page's cream (#FFF8F0, the manifest's background_color) with the app tile in the middle,
// as Android's launch screen shows the icon on background_color. The tile is the master one
// (scripts/icon-art.mjs, docs/design.md "App icon"), 30% of the screen's width.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { compressPng } from "./compress-images.mjs";
import { GRADIENT, tileArt } from "./icon-art.mjs";

const screens = JSON.parse(readFileSync(new URL("../lib/ios-splash.json", import.meta.url), "utf8"));

function splash(w, h) {
  const tile = Math.round(w * 0.3);
  const x = (w - tile) / 2;
  const y = (h - tile) / 2;
  const radius = tile * (185 / 824); // the installed icon's corner, on the macOS grid
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${GRADIENT}<filter id="s" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="${tile * 0.012}" stdDeviation="${tile * 0.015}" flood-color="#5A2A1A" flood-opacity="0.18"/>
  </filter></defs>
  <rect width="${w}" height="${h}" fill="#FFF8F0"/>
  <g filter="url(#s)"><g transform="translate(${x} ${y}) scale(${tile / 64})">${tileArt({ rx: radius * (64 / tile) })}</g></g>
</svg>`;
}

const out = "public/splash";
mkdirSync(out, { recursive: true });
const done = new Set();
for (const { width, height, ratio } of screens) {
  const [w, h] = [width * ratio, height * ratio];
  if (done.has(`${w}x${h}`)) continue;
  done.add(`${w}x${h}`);
  const png = await sharp(Buffer.from(splash(w, h))).png().toBuffer();
  writeFileSync(`${out}/iphone-${w}x${h}.png`, await compressPng(png)); // the palette only if it doesn't band the gradient
}
console.log(`${done.size} launch screens written to ${out}`);
