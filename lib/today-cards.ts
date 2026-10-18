import type { HabitName } from "@/supabase/functions/_shared/habit-title";
import { isolate, type T } from "@/supabase/functions/_shared/i18n";

export type GentleCardInput = {
  purpose: "me" | "family" | "friends" | null;
  hasCheckedIn: boolean;
  groups: { group_id: string; kind: string; role: string; child_count: number }[];
  dismissed: Set<string>;
};
export type GentleCard = { key: "invite_family" | "invite_friend" } | { key: `add_child:${string}`; groupId: string };

// ideas/onboarding.md → "After the first check-in: gentle cards on Today". One at a time; each
// dismissable per user (dismissed_cards). (The "never on a milestone day" rule went with the group
// milestone card: owner 2026-10-04, no group cards on Today.)
export function chooseGentleCard(i: GentleCardInput): GentleCard | null {
  if (!i.hasCheckedIn) return null;
  if (i.groups.length === 0) {
    if (i.purpose === "family" && !i.dismissed.has("invite_family")) return { key: "invite_family" };
    if (i.purpose === "friends" && !i.dismissed.has("invite_friend")) return { key: "invite_friend" };
    return null;
  }
  const g = i.groups.find(
    (x) => x.kind === "family" && x.role === "admin" && x.child_count === 0 && !i.dismissed.has(`add_child:${x.group_id}`),
  );
  return g ? { key: `add_child:${g.group_id}`, groupId: g.group_id } : null;
}

// family_recaps(): the generated types say non-null, but best_* is null when no group streak is running.
export type FamilyRecap = {
  group_id: string;
  group_name: string;
  week_start: string;
  check_ins: number;
  best_title: string | null;
  // habits.template_id of the best habit (lib/today-cards-data.ts shows best_title by it).
  best_template?: string | null;
  best_emoji: string | null;
  best_streak: number | null;
  best_period: string | null;
};

// The best habit as the viewer reads it: a template habit in their language (best_template), else the stored title.
export const namedRecap = <R extends FamilyRecap>(r: R, name: HabitName): R =>
  r.best_title == null ? r : { ...r, best_title: name(r.best_title, r.best_template) };

export const recapKey = (r: Pick<FamilyRecap, "group_id" | "week_start">) => `family_recap:${r.group_id}:${r.week_start}`;

// Wins only (§7): a week without check-ins shows nothing rather than a zero.
export function visibleRecaps<R extends FamilyRecap>(recaps: R[], dismissed: Set<string>): R[] {
  return recaps.filter((r) => r.check_ins > 0 && !dismissed.has(recapKey(r)));
}

// The weekly family recap, at the top of the Inbox's Activity tab on the first day of the group's week.
export function recapLine(t: T, r: FamilyRecap): string {
  if (!r.best_title || !r.best_streak) return t("push.familyRecap.plain", { n: r.check_ins });
  const period = r.best_period === "week" || r.best_period === "month" ? r.best_period : "day";
  return t("push.familyRecap.best", { n: r.check_ins, habit: isolate(r.best_title), span: t(`units.${period}`, { n: r.best_streak }) });
}
