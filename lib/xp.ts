// lib/xp.ts
// The "+10 XP" float (ideas/achievements-and-rewards.md §1). The database grants the XP; this only says
// whether the check-in it just returned already counts. A check-in waiting for approval earns its XP when
// it's approved, so it shows nothing now.
export const CHECK_IN_XP = 10;
export const checkInXp = (status: string | null | undefined): number => (status === "approved" ? CHECK_IN_XP : 0);

// How far the app server's clock may trail the database's when telling a fresh row from an old one.
// Below the queue's first retry (3 s, lib/offline-client.ts RETRY_DELAYS_MS), so an earlier send of
// the same tap is always older than this.
export const CLOCK_SKEW_MS = 2_000;

// The XP of what public.check_in returned, for the "+10 XP" float. check_in returns a row it did not
// insert in two cases, and neither earns anything now:
// - a resend: a row with this tap's client_id already existed (an earlier try landed). Told apart by
//   created_at: check_in stamps a new row with the database's now(), so a row created before this
//   request started (less CLOCK_SKEW_MS) was made by an earlier request;
// - a quiet merge: another adult's row for a child (a different client_id).
// A dropped too-old tap returns null. `startedAt`: Date.now() just before the rpc.
export function checkInRowXp(
  row: { status: string; client_id: string | null; created_at: string } | null | undefined,
  tap: { clientId: string } | undefined,
  startedAt: number,
): number {
  if (!row) return 0;
  if (tap && row.client_id !== tap.clientId) return 0;
  if (Date.parse(row.created_at) < startedAt - CLOCK_SKEW_MS) return 0;
  return checkInXp(row.status);
}

// What the check-in button floats after a tap. Online: what the server said (submitTap's xp). A tap
// waiting on the phone floats at once, as it would online (ideas/offline.md §1), unless the habit needs
// approval (it will wait for someone else). The sync later never floats again: only the tap does.
export function tapXp(result: { queued: boolean; xp?: number }, needsApproval: boolean): number {
  if (result.queued) return needsApproval ? 0 : CHECK_IN_XP;
  return result.xp ?? 0;
}
