// Shared by the app (Node) and send-push (Deno): keep it import-free (types only).
// A habit made from a template shows its name in the viewer's language; a typed (or renamed) name
// stays as typed. habits.template_id: '<id>' (adult and group templates), 'kid.<id>' (kid templates).
import type { T } from "./i18n.ts";

// A known template id → its catalog title (templates.<id>); null, unknown or forged → the stored title.
export function habitTitle(t: T, title: string, templateId: string | null | undefined, knownIds: ReadonlySet<string>): string {
  return templateId && knownIds.has(templateId) ? t(`templates.${templateId}`) : title;
}

// The displayed name for a stored title and its template, with the viewer's translator bound.
export type HabitName = (title: string, templateId?: string | null) => string;
export const habitNamer = (t: T, knownIds: ReadonlySet<string>): HabitName => (title, templateId) => habitTitle(t, title, templateId, knownIds);

// The habit template ids in a catalog's `templates`: its string leaves, plus `kid.<id>` for the kid
// templates. Treats and kid group names are not habits.
export function templateIdsIn(templates: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const [k, v] of Object.entries(templates)) if (typeof v === "string") ids.add(k);
  const kid = templates.kid;
  if (kid && typeof kid === "object") for (const [k, v] of Object.entries(kid)) if (typeof v === "string") ids.add(`kid.${k}`);
  return ids;
}

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const named = (name: HabitName, r: unknown): unknown =>
  isRow(r) && typeof r.title === "string" ? { ...r, title: name(r.title, typeof r.template === "string" ? r.template : null) } : r;

// A feed/push payload's habit rows ({ title, template }) with their displayed names: the daily
// summary's todo and at_risk, a recap's longest and top, a family recap's best.
export function namedPayload(payload: Row, name: HabitName): Row {
  const out: Row = { ...payload };
  for (const k of ["todo", "at_risk", "top"]) if (Array.isArray(out[k])) out[k] = (out[k] as unknown[]).map((r) => named(name, r));
  for (const k of ["longest", "best"]) if (isRow(out[k])) out[k] = named(name, out[k]);
  return out;
}
