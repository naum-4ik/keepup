// The Inbox's approval answers (docs/design.md "States and feedback"). Kept free of React and Next so
// they are unit-tested (lib/inbox-toasts.test.ts). The row leaves the list once the page refreshes,
// so the toast says what the decision did; names are isolated (a Hebrew name in an English line).
import { isolate, type T } from "@/supabase/functions/_shared/i18n";

export type Reviewed = { name: string; habit: string; approve: boolean };

// "Approved: Alex · Gym. It counts toward the streak." / "Not approved: Alex · Gym. It won't count…"
export const reviewedText = (t: T, r: Reviewed): string =>
  t(r.approve ? "inbox.approvals.approved" : "inbox.approvals.declined", { name: isolate(r.name), habit: isolate(r.habit) });

// Approve all: how many the server approved (0 when someone reviewed them all first).
export const approvedAllText = (t: T, n: number): string => t("inbox.approvals.approvedAll", { n });

type Answer = { ok: true } | { ok: false; message: string };

// A server action that never answered (offline, or the request died) throws: say what to do instead
// of leaving the button stuck. Offline is checked first, so nothing is sent that can't arrive.
export async function reachServer<R extends { ok: boolean }>(
  t: T,
  call: () => Promise<R>,
  online: () => boolean = () => typeof navigator === "undefined" || navigator.onLine,
): Promise<R | Answer> {
  const failed: Answer = { ok: false, message: t("inbox.approvals.failed") };
  if (!online()) return failed;
  try {
    return await call();
  } catch {
    return failed;
  }
}
