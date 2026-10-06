// Never two bursts at once (docs/design.md, Motion): finish cards, "Everyone did it", Today's all-done
// confetti and the level-up / badge moment take turns. Each waits until the one before it is over. A
// confetti burst runs 900 ms; a little air after it. The moment holds its turn while it shows.
export const CONFETTI_TURN_MS = 1200;

export type Turns = { freeAt: number };
export type Turn = { wait: number; release: (at: number) => void };

// Returns how long this burst waits, and `release`: hand the rest of the turn back (gone before its
// turn, or closed early), unless someone already queued behind it.
export function takeTurn(turns: Turns, now: number, ms = CONFETTI_TURN_MS): Turn {
  const start = Math.max(now, turns.freeAt);
  const end = start + ms;
  turns.freeAt = end;
  return {
    wait: start - now,
    release: (at) => {
      if (turns.freeAt === end) turns.freeAt = Math.min(end, Math.max(start, at));
    },
  };
}

// The one queue every burst on the page shares (client only).
const shared: Turns = { freeAt: 0 };
export function takeBurstTurn(ms = CONFETTI_TURN_MS): { wait: number; release: () => void } {
  const turn = takeTurn(shared, Date.now(), ms);
  return { wait: turn.wait, release: () => turn.release(Date.now()) };
}
