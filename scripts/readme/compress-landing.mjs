// The landing pictures ship in the app (public/landing), so each stays under 300 KB: a 256-colour PNG,
// same size. sharp comes with Next.js (its image optimizer). Run after sips, before check-sizes.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = "public/landing";
const LIMIT = 300 * 1024;
let tooBig = false;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
  const path = `${dir}/${f}`;
  writeFileSync(path, await sharp(path).png({ palette: true, quality: 90, effort: 10 }).toBuffer());
  const kb = Math.round(statSync(path).size / 1024);
  console.log(`${path}: ${kb} KB`);
  if (kb * 1024 > LIMIT) tooBig = true;
}
if (tooBig) {
  console.error("A landing picture is over 300 KB.");
  process.exit(1);
}
