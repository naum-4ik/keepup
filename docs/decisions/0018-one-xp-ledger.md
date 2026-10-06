# 0018. One XP ledger, idempotent by key, levels synced once per path

**Status:** Accepted · 2026-10-06

## Context
XP comes from check-ins, approvals and finished periods. A check-in can be undone, an approval can come hours later, and since offline check-ins (0015) a settled period can change from missed to done up to 3 days later. A grant must never be paid twice, and finalization touching many habits must not deadlock on level updates.

## Decision
- One append-only table, `xp_events`, with a unique key (`user_id`, `reason`, `source_type`, `source_id`). Every grant goes through one function, `private.grant_xp`, which does nothing for a key it has seen. An undo inserts a negative row; nothing is updated.
- Amounts: +10 per counted check-in, +2 to the reviewer per approval, +20 per done private period, +30 per required member of a done group period. An undo reverses exactly what was granted, looked up from the ledger.
- Streak bonus (owner, 2026-10-06), from then on only: the first counted check-in of a period earns 10 + the streak before it, at most +30; every further check-in in the same period earns the base +10 (8 a day on a 20-day streak: 30 + 7 × 10 = 100). Undoing the first doesn't re-grant the others.
- Period XP is also paid when a late check-in or approval upgrades a settled period, through the same function.
- Level is `floor(sqrt(xp / 50)) + 1`, derived from the sum. `level_ups` keeps one row per level reached.
- `grant_xp` takes no profile lock. Paths that touch many habits (finalization, "Approve all", "Me + Mary") defer the level sync and run it once at the end, in user-id order, so lock order is the same everywhere.
- Past history was counted once, quietly (no Inbox rows, levels marked seen), and the streak-scaled amount did not rewrite it.
- Kids earn through the same ledger, behind the scenes; their view never shows it.

## Consequences
- Re-running finalization, resending a webhook or upgrading twice changes nothing.
- XP is a sum, cheap at this scale; a stored total can come later if it isn't.
- A new XP source is a new `reason`, not a new table.
