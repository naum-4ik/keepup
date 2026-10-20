import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, mix } from "./contrast";

// The colour tokens in app/globals.css meet WCAG 2.2 AA where the app uses them (docs/design.md
// "Contrast"): text 4.5:1, UI parts and focus indicators 3:1, in light and dark.

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

function blockAt(src: string, at: number): string {
  if (at < 0) throw new Error("block not found");
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i);
  }
  throw new Error("unbalanced braces");
}

function hexVars(body: string): Record<string, string> {
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const light = hexVars(blockAt(css, css.search(/^:root\s*\{/m)));
const darkMedia = blockAt(css, css.search(/@media \(prefers-color-scheme: dark\)\s*\{/));
const dark = { ...light, ...hexVars(blockAt(darkMedia, darkMedia.indexOf(":root"))) };
const themes = { light, dark };

// "token", or "token/alpha>under": a tint (bg-destructive/10) composited over an opaque surface.
function color(tokens: Record<string, string>, spec: string): string {
  const m = /^([a-z0-9-]+)(?:\/(\d+)>([a-z0-9-]+))?$/.exec(spec);
  if (!m) throw new Error(`Bad colour spec: ${spec}`);
  const [, name, alpha, under] = m;
  const own = tokens[name];
  if (!own) throw new Error(`No --${name} in globals.css`);
  return alpha ? mix(own, Number(alpha) / 100, color(tokens, under)) : own;
}

type Theme = keyof typeof themes;
type Pair = { fg: string; bg: string; min: number; only?: Theme };
const TEXT = 4.5;
const UI = 3;

const surfaces = ["background", "card"];
const cats = ["health", "fitness", "mind", "learning", "people", "home", "work-money", "break-habit"];

const pairs: Pair[] = [
  // Text.
  ...["background", "card", "muted", "accent", "secondary", "done-soft", "pending-soft", "frozen-soft", "flame-soft"].map((bg) => ({ fg: "foreground", bg, min: TEXT })),
  ...[...surfaces, "muted", "accent", "secondary", "muted/60>card", "muted/50>card", "muted/60>background"].map((bg) => ({ fg: "muted-foreground", bg, min: TEXT })),
  { fg: "muted-foreground", bg: "input/30>card", min: TEXT, only: "dark" }, // placeholder on a dark field
  // Links and text buttons, also on their hover tints (hover:bg-accent, hover:bg-muted).
  ...[...surfaces, "accent", "muted", "secondary"].map((bg) => ({ fg: "primary", bg, min: TEXT })),
  { fg: "primary-foreground", bg: "primary", min: TEXT },
  { fg: "background", bg: "foreground", min: TEXT }, // toast, tooltip
  ...[...surfaces, "done-soft", "muted"].map((bg) => ({ fg: "done", bg, min: TEXT })),
  { fg: "done-foreground", bg: "done", min: TEXT },
  ...[...surfaces, "pending-soft"].map((bg) => ({ fg: "pending", bg, min: TEXT })),
  ...[...surfaces, "frozen-soft"].map((bg) => ({ fg: "frozen", bg, min: TEXT })),
  ...[...surfaces, "destructive/10>card", "destructive/10>background"].map((bg) => ({ fg: "destructive", bg, min: TEXT })),
  { fg: "destructive", bg: "destructive/20>card", min: TEXT, only: "light" }, // destructive button hover
  { fg: "destructive", bg: "destructive/20>background", min: TEXT, only: "light" },
  { fg: "destructive", bg: "destructive/15>card", min: TEXT, only: "dark" },
  { fg: "destructive", bg: "destructive/15>background", min: TEXT, only: "dark" },
  // The streak count is 14px bold: normal text.
  ...surfaces.map((bg) => ({ fg: "flame", bg, min: TEXT })),
  // UI parts: field borders (the only edge a transparent input has), focus outline, fills.
  ...surfaces.map((bg) => ({ fg: "input", bg, min: UI })),
  ...surfaces.map((bg) => ({ fg: "ring", bg, min: UI })),
  ...surfaces.map((bg) => ({ fg: "primary", bg, min: UI })),
  { fg: "done", bg: "card", min: UI },
  // Category icons on their chips.
  ...cats.map((c) => ({ fg: `cat-${c}`, bg: `cat-${c}-soft`, min: UI })),
];

describe("colour tokens meet WCAG AA", () => {
  for (const theme of ["light", "dark"] as const) {
    const tokens = themes[theme];
    for (const { fg, bg, min, only } of pairs) {
      if (only && only !== theme) continue;
      it(`${theme}: ${fg} on ${bg} ≥ ${min}:1`, () => {
        expect(contrastRatio(color(tokens, fg), color(tokens, bg))).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#FFF", "#767676")).toBeCloseTo(4.54, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#AD4529", "#FFF8F0")).toBe(contrastRatio("#FFF8F0", "#AD4529"));
  });
});

describe("mix", () => {
  it("composites a tint over a surface", () => {
    expect(mix("#000000", 0.5, "#FFFFFF")).toBe("#808080");
    expect(mix("#C0392B", 0, "#FFF8F0")).toBe("#FFF8F0");
    expect(mix("#C0392B", 1, "#FFF8F0")).toBe("#C0392B");
  });
});
