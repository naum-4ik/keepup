import { formatMonth } from "@/lib/dates";
import { recapCopy } from "@/lib/notification-copy";
import { INTL_LOCALE, isolate, type Locale, type T } from "@/supabase/functions/_shared/i18n";

// Progress → Recaps (ideas/achievements-and-rewards.md §6): the shape of private.recap_impl.
export type Streak = { title: string; emoji: string; length: number; period: "day" | "week" | "month" };
export type RecapDay = { date: string; done: number; possible: number; rested: number };
export type Recap = {
  kind: "week" | "month"; start: string; end: string; done: number; possible: number;
  longest: Streak | null; top: Streak[]; badges: { code: string; name: string }[];
  days: RecapDay[];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseStreak(v: unknown): Streak | null {
  if (!isObj(v) || typeof v.title !== "string" || typeof v.length !== "number") return null;
  const period = v.period === "week" || v.period === "month" ? v.period : "day";
  return { title: v.title, emoji: typeof v.emoji === "string" ? v.emoji : "", length: v.length, period };
}

export function parseRecap(v: unknown): Recap | null {
  if (!isObj(v) || (v.kind !== "week" && v.kind !== "month") || typeof v.start !== "string" || !DATE.test(v.start)) return null;
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    kind: v.kind, start: v.start, end: typeof v.end === "string" ? v.end : v.start,
    done: Number(v.done ?? 0), possible: Number(v.possible ?? 0),
    longest: parseStreak(v.longest),
    top: arr(v.top).map(parseStreak).filter((s): s is Streak => s !== null),
    badges: arr(v.badges).filter(isObj).map((b) => ({ code: String(b.code), name: String(b.name) })),
    days: arr(v.days).filter(isObj).map((d) => ({
      date: String(d.date), done: Number(d.done ?? 0), possible: Number(d.possible ?? 0), rested: Number(d.rested ?? 0),
    })),
  };
}

// "8 Oct": day and month in the language's order. English keeps fixed abbreviations: newer ICU
// data spells September "Sept" in en-GB.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMonth = (locale: Locale, start: string): string =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "short" })
    .formatToParts(new Date(`${start}T00:00:00Z`))
    .map((p) => (locale === "en" && p.type === "month" ? MON[Number(start.slice(5, 7)) - 1] : p.value))
    .join("");
export function recapTitle(t: T, locale: Locale, r: Recap): string {
  return r.kind === "week"
    ? t("recaps.weekOf", { date: dayMonth(locale, r.start) })
    : formatMonth(r.start.slice(0, 7), locale);
}

// Wins only (owner 2026-10-04): never "0 of N".
// `context`: "history" drops the Inbox row's "last week" (the card is dated already).
export function recapLine(t: T, locale: Locale, r: Recap, context: "inbox" | "history" = "inbox"): string {
  if (r.possible > 0 && r.done === 0) return t(r.kind === "week" ? "recaps.quietWeek" : "recaps.quietMonth");
  return recapCopy(t, locale, r as unknown as Record<string, unknown>, context)?.body ?? t("recaps.nothingDue");
}

// 0 = nothing due that day; 1–4 = a share of it done (1 is a soft tint, never red).
export function heatLevel(done: number, possible: number): 0 | 1 | 2 | 3 | 4 {
  if (possible <= 0) return 0;
  const share = done / possible;
  if (share >= 1) return 4;
  if (share >= 0.5) return 3;
  if (share > 0) return 2;
  return 1;
}

export const streakLabel = (t: T, s: Streak): string => t("recaps.streak", { title: isolate(s.title), span: t(`units.${s.period}`, { n: s.length }) });
