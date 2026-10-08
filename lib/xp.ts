// lib/xp.ts
// The "+N XP" float (ideas/achievements-and-rewards.md §1). The database decides the XP: a check-in earns
// 10, and the first one of its period also 1 per day (or week, month) of the streak before it, at most
// +30 (private.check_in_streak, rewards_on_check_in). This
// only says whether the check-in a request just returned counts now, and how to show what it earned.
// A check-in waiting for approval earns its XP when it's approved, so it shows nothing now.

// What a check-in floats: a number of XP, or null for "+XP" — it counted, but the amount isn't known
// here (a tap still waiting on the phone: the database sets it when the tap lands, by the streak it
// sees then; or the ledger couldn't be read). 0: nothing to float.
export type TapXp = number | null;

export const xpLabel = (xp: TapXp): string => (xp === null ? "+XP" : `+${xp} XP`);

// How far the app server's clock may trail the database's when telling a fresh row from an old one.
// Below the queue's first retry (3 s, lib/offline-client.ts RETRY_DELAYS_MS), so an earlier send of
// the same tap is always older than this.
export const CLOCK_SKEW_MS = 2_000;

// Whether what public.check_in returned is a check-in this request made that counts now (approved), so
// its XP is worth floating. check_in returns a row it did not insert in two cases, and neither earns
// anything now:
// - a resend: a row with this tap's client_id already existed (an earlier try landed). Told apart by
//   created_at: check_in stamps a new row with the database's now(), so a row created before this
//   request started (less CLOCK_SKEW_MS) was made by an earlier request;
// - a quiet merge: another adult's row for a child (a different client_id).
// A dropped too-old tap returns null. `startedAt`: Date.now() just before the rpc.
export function countsNow(
  row: { status: string; client_id: string | null; created_at: string } | null | undefined,
  tap: { clientId: string } | undefined,
  startedAt: number,
): boolean {
  if (!row) return false;
  if (tap && row.client_id !== tap.clientId) return false;
  if (Date.parse(row.created_at) < startedAt - CLOCK_SKEW_MS) return false;
  return row.status === "approved";
}

// What the check-in button floats after a tap. Online: what the server granted (submitTap's xp, read
// from the ledger). A tap waiting on the phone floats "+XP" at once, as it would online
// (ideas/offline.md §1), with no number: the amount depends on the streak the database sees when the
// tap lands (yesterday may still be settling, a group habit counts the own part), so a number guessed
// from the page could be wrong. Nothing if the habit needs approval (it will wait for someone else).
// The sync later never floats again: only the tap does.
export function tapXp(result: { queued: boolean; xp?: TapXp }, needsApproval: boolean): TapXp {
  if (result.queued) return needsApproval ? 0 : null;
  return result.xp === undefined ? 0 : result.xp;
}
