// Every README and landing screenshot must have the same size, so the rows line up and the landing's
// fixed <Image> size holds. Run after the screenshots.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dirs = ["docs/screenshots", "public/landing"];
const sizes = dirs.flatMap((dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => {
      const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", `${dir}/${f}`], { encoding: "utf8" });
      const [w, h] = [...out.matchAll(/pixel(?:Width|Height): (\d+)/g)].map((m) => m[1]);
      return { f: `${dir}/${f}`, size: `${w}x${h}` };
    }),
);
const distinct = new Set(sizes.map((s) => s.size));
if (distinct.size > 1) {
  console.error("Screenshots differ in size:\n" + sizes.map((s) => `  ${s.f}: ${s.size}`).join("\n"));
  process.exit(1);
}
console.log(`Screenshots: ${sizes.length} files, all ${[...distinct][0]}`);
