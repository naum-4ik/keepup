import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES } from "@/i18n/client-namespaces";

// Guard for i18n/client-namespaces.ts: the browser gets only those namespaces, so a client component
// reading any other one would show a raw key. Static scan, regex based:
// 1. roots: "use client" files, files calling useTranslations/useT (they may render on the client),
//    and modules typed with FieldError (server actions return their validation keys untranslated);
// 2. from each, follow the imports it hands a translator to: fn(…, t, …) and <Comp t={t}>;
// 3. collect useTranslations("ns") and every "ns.…" / `ns.${…}` literal whose ns is a catalog namespace.
const root = process.cwd();
const en = JSON.parse(readFileSync(join(root, "supabase/functions/_shared/messages/en.json"), "utf8")) as Record<string, unknown>;
const catalog = new Set(Object.keys(en));
const TR = "(?:t|tr|tx|tf)"; // the names this codebase gives translators

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
const read = (f: string) => readFileSync(f, "utf8");
const serverOnly = (s: string) => /^\s*["']use server["']/.test(s) || /import\s+["']server-only["']/.test(s);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((c) => existsSync(c)) ?? null;
}

// Imported identifier → its module; `export * from` sources pass through.
function importsOf(file: string, s: string) {
  const byName = new Map<string, string>();
  for (const m of s.matchAll(/import\s+([^"';]+?)\s+from\s+["']([^"']+)["']/g)) {
    const mod = resolveImport(file, m[2]);
    if (!mod) continue;
    for (const id of m[1].replace(/[{}*]|\bas\b|\btype\b/g, " ").split(/[\s,]+/).filter(Boolean)) byName.set(id, mod);
  }
  const reexports = [...s.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)].map((m) => resolveImport(file, m[1])).filter((m): m is string => !!m);
  return { byName, reexports };
}

function scan(): Map<string, Set<string>> {
  const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
  const roots = files.filter((f) => {
    const s = read(f);
    if (serverOnly(s)) return false;
    return /^\s*["']use client["']/.test(s) || /\buse(Translations|T)\(/.test(s) || /\bFieldError\b[^;]*from\s+["']@\/lib\/field-error["']/.test(s);
  });
  const found = new Map<string, Set<string>>();
  const add = (ns: string, f: string) => found.set(ns, (found.get(ns) ?? new Set()).add(relative(root, f)));
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const s = read(f);
    for (const m of s.matchAll(/useTranslations\(\s*["'`](\w+)/g)) add(m[1], f);
    for (const m of s.matchAll(/["'`]([a-zA-Z]+)\.[\w$]/g)) if (catalog.has(m[1])) add(m[1], f);
    const { byName, reexports } = importsOf(f, s);
    const callees = [
      ...[...s.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)(?:\\.[\\w$]+)?\\([^()]*\\b${TR}\\s*[,)]`, "g"))].map((m) => m[1]),
      ...[...s.matchAll(new RegExp(`<([A-Z][\\w$]*)\\b[^>]*?\\bt=\\{${TR}\\}`, "g"))].map((m) => m[1]),
    ];
    for (const c of callees) {
      const mod = byName.get(c);
      if (mod && !serverOnly(read(mod))) queue.push(mod);
    }
    if (!roots.includes(f)) queue.push(...reexports);
  }
  return found;
}

describe("client namespaces", () => {
  const found = scan();
  const listed = new Set<string>(CLIENT_NAMESPACES);

  it("finds client reads (the scan works)", () => {
    expect(found.get("nav")).toContain("components/app-shell/bottom-nav.tsx"); // useTranslations / keys in constants
    expect(found.get("templates")).toContain("lib/habit-templates.ts"); // via templateTitle(t, …) in habit-form
    expect(found.get("validation")).toContain("lib/profile-schema.ts"); // FieldError from a server action
  });

  it("every namespace client code reads is sent to the browser", () => {
    const missing = [...found].filter(([ns]) => !listed.has(ns)).map(([ns, where]) => `${ns} (${[...where].join(", ")})`);
    expect(missing, "add these to i18n/client-namespaces.ts").toEqual([]);
  });

  it("every listed namespace exists and is still read by client code", () => {
    expect(CLIENT_NAMESPACES.filter((ns) => !catalog.has(ns)), "not in en.json").toEqual([]);
    expect(CLIENT_NAMESPACES.filter((ns) => !found.has(ns)), "no client code reads these: drop them").toEqual([]);
  });

  it("keeps server-only namespaces off the page", () => {
    expect(listed.has("push")).toBe(false);
  });
});
