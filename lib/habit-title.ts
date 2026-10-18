import { GROUP_TEMPLATES } from "@/lib/group-templates";
import { HABIT_TEMPLATES } from "@/lib/habit-templates";
import { KID_TEMPLATES } from "@/lib/kid-templates";
import { habitNamer, type HabitName } from "@/supabase/functions/_shared/habit-title";
import type { T } from "@/supabase/functions/_shared/i18n";

// Every template a habit can come from, as habits.template_id stores it (kid ones as `kid.<id>`).
export const TEMPLATE_IDS: ReadonlySet<string> = new Set([
  ...[...HABIT_TEMPLATES, ...GROUP_TEMPLATES].map((x) => x.id),
  ...KID_TEMPLATES.map((x) => `kid.${x.id}`),
]);

// The viewer's name for a habit: a template's title in their language, else the stored title.
export const habitNameFor = (t: T): HabitName => habitNamer(t, TEMPLATE_IDS);

// A known template's title in each given catalog (templates.<id>; kid ids walk templates.kid.<id>).
export function templateTitlesIn(catalogs: readonly Record<string, unknown>[], templateId: string | null): string[] {
  if (!templateId || !TEMPLATE_IDS.has(templateId)) return [];
  const path = ["templates", ...templateId.split(".")];
  return catalogs
    .map((c) => path.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], c))
    .filter((v): v is string => typeof v === "string");
}

// The edit form is filled with the displayed title. Only a different name is a rename: saving the
// displayed one as is must not store a translation over the title or drop the template. The template's
// title in any language (`templateTitles`: the form may have opened before a language switch) and the
// stored title count as unchanged too.
export const isRename = (
  name: HabitName,
  submitted: string,
  stored: { title: string; template_id: string | null },
  templateTitles: readonly string[] = [],
): boolean => submitted !== stored.title && submitted !== name(stored.title, stored.template_id) && !templateTitles.includes(submitted);

// The template a new habit keeps (habits.template_id): only a known one, and only under the template's
// own title. A name typed over it is the person's own and stays as typed in every language.
export const templateKept = (t: T, templateId: string | undefined, title: string): string | undefined =>
  templateId && TEMPLATE_IDS.has(templateId) && t(`templates.${templateId}`) === title ? templateId : undefined;
