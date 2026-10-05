// lib/xp.ts
// The "+10 XP" float (ideas/achievements-and-rewards.md §1). The database grants the XP; this only says
// whether the check-in it just returned already counts. A check-in waiting for approval earns its XP when
// it's approved, so it shows nothing now.
export const CHECK_IN_XP = 10;
export const checkInXp = (status: string | null | undefined): number => (status === "approved" ? CHECK_IN_XP : 0);

// What the check-in button floats after a tap. Online: what the server said (submitTap's xp). A tap
// waiting on the phone floats at once, as it would online (ideas/offline.md §1), unless the habit needs
// approval (it will wait for someone else). The sync later never floats again: only the tap does.
export function tapXp(result: { queued: boolean; xp?: number }, needsApproval: boolean): number {
  if (result.queued) return needsApproval ? 0 : CHECK_IN_XP;
  return result.xp ?? 0;
}
