// Shrinks PNGs in place, same pixels size. Run: node scripts/compress-images.mjs [files or folders…]
// (no arguments: every PNG folder of the repo). Uses sharp, which Next.js already installs.
//
// Each file is encoded twice: as a 256-colour palette (what pngquant does) and losslessly at the highest
// zlib level (no "effort" there: in sharp it switches the palette on). The palette wins only when it is
// visually lossless: a premultiplied PSNR of at least 50 dB against the original. Below that it bands soft
// gradients (the glow in the kid view, at 47.8 dB, showed a ring). A file that is already a palette PNG is
// never quantized again (each pass would drift further from the original): its palette encoding must be
// pixel-identical. The smaller accepted encoding is written only if it saves at least 1% on disk, so a rerun
// on compressed files changes nothing.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const DEFAULT = ["app", "docs/screenshots", "docs/observability/screenshots", "public/icons", "public/splash"];
const MIN_PSNR = 50;

// Compare with alpha applied, so the colour of fully transparent pixels doesn't count.
async function psnr(a, b) {
  const [x, y] = await Promise.all([a, b].map((buf) => sharp(buf).ensureAlpha().raw().toBuffer()));
  let se = 0;
  for (let i = 0; i < x.length; i += 4) {
    const [ax, ay] = [x[i + 3] / 255, y[i + 3] / 255];
    for (let c = 0; c < 3; c++) se += (x[i + c] * ax - y[i + c] * ay) ** 2;
    se += (x[i + 3] - y[i + 3]) ** 2;
  }
  return se === 0 ? Infinity : 10 * Math.log10((255 * 255) / (se / x.length));
}

// The smallest visually lossless encoding of a PNG buffer (may be larger than the input).
export async function compressPng(input) {
  const lossless = await sharp(input).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  const palette = await sharp(input).png({ compressionLevel: 9, effort: 10, palette: true, quality: 100 }).toBuffer();
  const { isPalette } = await sharp(input).metadata();
  const ok = palette.length < lossless.length && (await psnr(input, palette)) >= (isPalette ? Infinity : MIN_PSNR);
  return ok ? palette : lossless;
}

function pngs(path) {
  if (statSync(path).isFile()) return path.endsWith(".png") ? [path] : [];
  return readdirSync(path).flatMap((f) => pngs(join(path, f)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = (process.argv.length > 2 ? process.argv.slice(2) : DEFAULT).flatMap(pngs);
  let [before, after] = [0, 0];
  for (const f of files) {
    const input = readFileSync(f);
    // A second pass can still shave a pixel-identical percent off a fresh palette PNG; stop below 1% (churn).
    let keep = input;
    for (let out = await compressPng(keep); out.length < keep.length * 0.99; out = await compressPng(keep)) keep = out;
    if (keep !== input) writeFileSync(f, keep);
    before += input.length;
    after += keep.length;
  }
  console.log(`compressed ${files.length} PNGs: ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
}
