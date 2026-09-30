import { isOneEmoji } from "@/lib/habit-schema";

export const CHILD_NAME_MAX = 40;
export const GOAL_TITLE_MAX = 40;
export const GOAL_DEFAULT_TARGET = 20;
export const GOAL_DEFAULT_EMOJI = "🎁";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// A nickname only (privacy policy §9). Postgres counts code points, so count the same way.
export function parseChildName(raw: string): Parsed<string> {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Enter a nickname." };
  if ([...value].length > CHILD_NAME_MAX) return { ok: false, error: `Keep it to ${CHILD_NAME_MAX} characters.` };
  return { ok: true, value };
}

// A treat goal: 1–200 stars (the treat_goals check), a short title, one emoji (🎁 when none).
export function parseGoal(values: { title: string; emoji: string; target: string }): Parsed<{ title: string; emoji: string; target: number }> {
  const title = values.title.trim();
  const emoji = values.emoji.trim() || GOAL_DEFAULT_EMOJI;
  const target = Number(values.target);
  if (title === "") return { ok: false, error: "Name the treat." };
  if ([...title].length > GOAL_TITLE_MAX) return { ok: false, error: `Keep it to ${GOAL_TITLE_MAX} characters.` };
  if (!isOneEmoji(emoji)) return { ok: false, error: "Pick one emoji." };
  if (values.target === "" || !Number.isInteger(target) || target < 1 || target > 200) return { ok: false, error: "Pick 1–200 stars." };
  return { ok: true, value: { title, emoji, target } };
}

// keepup-{nickname}-{date}.json, in the viewer's local date; unsafe file-name characters become "-".
export function exportFileName(name: string, now = new Date()): string {
  const safe = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "child";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `keepup-${safe}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
