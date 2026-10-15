import type { T } from "@/supabase/functions/_shared/i18n";

// WAI-ARIA tabs keyboard pattern: the arrows move to the previous or next tab (wrapping), Home and
// End to the first and last. In right-to-left text the next tab is on the left, so the arrows swap.
// Null for any other key.
export function tabFromKey(key: string, current: number, count: number, dir: "ltr" | "rtl"): number | null {
  if (count === 0) return null;
  const [nextKey, prevKey] = dir === "rtl" ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"];
  if (key === nextKey) return (current + 1) % count;
  if (key === prevKey) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

// The Inbox's first tab: "Approvals (2)" while something waits; plain "Approvals" at zero (a "(0)"
// reads like a to-do). The tab itself stays, so its place never moves.
export const approvalsLabel = (t: T, count: number): string => (count > 0 ? t("tabs.approvalsCount", { n: count }) : t("tabs.approvals"));
