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
