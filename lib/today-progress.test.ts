import { describe, expect, it } from "vitest";
import { queuedDelta, type QueuedCheckIn } from "./offline-queue";
import { tEn } from "@/lib/i18n/test-t";
import { tFor } from "@/lib/i18n/test-t";
import { todayLine, todayProgress, todayStreak, withQueuedProgress } from "./today-progress";

const h = (id: string, state: "open" | "done" | "later", period: "day" | "week" = "day") => ({
  habit_id: id,
  title: id,
  emoji: null,
  category: "health" as const,
  target_count: 1,
  period,
  done_count: state === "done" ? 1 : 0,
  checked_in_today: state === "done",
  frozen: state === "later",
  not_started: false,
  pending_count: 0,
});

describe("todayProgress", () => {
  it("counts what's on today's lists: to do and done, not paused or later", () => {
    const p = todayProgress([h("read", "done"), h("water", "open"), h("walk", "later"), h("run", "open")]);
    expect(p).toMatchObject({ done: 1, total: 3 });
    expect(p.items.map((i) => `${i.habitId}:${i.done}`)).toEqual(["read:true", "water:false", "run:false"]);
  });

  it("counts a check-in waiting for approval as not done yet", () => {
    const waiting = { ...h("walk", "open"), checked_in_today: true, pending_count: 1 };
    const p = todayProgress([h("read", "done"), waiting]);
    expect(p).toMatchObject({ done: 1, total: 2 });
    expect(p.items.map((i) => `${i.habitId}:${i.done}`)).toEqual(["read:true", "walk:false"]);
    expect(todayLine(tEn, p.done, p.total)).toBe("Check in 1 more to finish today (1 of 2).");
  });

  it("counts a weekly check-in waiting for approval as not done yet", () => {
    const weekly = { ...h("walk", "open", "week"), target_count: 3, done_count: 1, checked_in_today: true, pending_count: 1 };
    const p = todayProgress([h("read", "done"), weekly]);
    expect(p).toMatchObject({ done: 1, total: 2 });
    expect(p.items.find((i) => i.habitId === "walk")?.done).toBe(false);
  });

  it("is empty when nothing is due today", () => {
    expect(todayProgress([h("walk", "later")])).toMatchObject({ done: 0, total: 0 });
  });
});

describe("todayLine", () => {
  it.each([
    [0, 5, "Check in 5 more to finish today."],
    [0, 1, "Check in 1 more to finish today."],
    [1, 5, "1 of 5 done. Check in 4 more to finish today."],
    [1, 6, "1 of 6 done. Check in 5 more to finish today."],
    [2, 4, "2 of 4 done. 2 more to finish today 💪"],
    [3, 5, "3 of 5 done. 2 more to finish today 💪"],
    [4, 5, "Check in 1 more to finish today (4 of 5)."],
    [1, 1, "Done for today 🎉"],
    [5, 5, "All 5 done 🎉"],
  ])("%i of %i → %s", (done, total, line) => {
    expect(todayLine(tEn, done, total)).toBe(line);
  });

  it("all done with a running streak: says it is safe", () => {
    expect(todayLine(tEn, 3, 3, 5)).toBe("All 3 done 🎉 Your 5-day streak is safe.");
    expect(todayLine(tEn, 3, 3, 0)).toBe("All 3 done 🎉");
  });

  it("ru and he: plural forms for the counts", () => {
    const ru = tFor("ru");
    expect(todayLine(ru, 0, 2)).toBe("Отметьте ещё 2, чтобы закончить день.");
    expect(todayLine(ru, 5, 5, 21)).toBe("Все 5 сделаны 🎉 Серия в 21 день сохранена.");
    expect(todayLine(ru, 3, 3, 5)).toBe("Все 3 сделаны 🎉 Серия в 5 дней сохранена.");
    const he = tFor("he");
    expect(todayLine(he, 2, 2, 2)).toBe("שניהם בוצעו 🎉 הרצף של יומיים נשמר.");
    expect(todayLine(he, 1, 3)).toBe("בוצעו 1 מתוך 3. סמנו עוד 2 כדי לסיים את היום.");
  });

  it("never uses guilt words", () => {
    const lines = [0, 1, 2, 3, 4, 5].map((d) => todayLine(tEn, d, 5)).join(" ").toLowerCase();
    for (const w of ["failed", "missed", "don't lose", "hurry", "last chance", "only", "lazy"]) expect(lines).not.toContain(w);
  });
});

describe("todayStreak", () => {
  it("the longest running streak among today's done daily habits", () => {
    const habits = [
      { ...h("read", "done"), current_streak: 4 },
      { ...h("walk", "done"), current_streak: 9 },
      { ...h("run", "open"), current_streak: 30 }, // not done today: not what today kept
      { ...h("gym", "done", "week"), current_streak: 12 }, // weeks, not days
    ];
    expect(todayStreak(habits)).toBe(9);
    expect(todayStreak([h("read", "done")])).toBe(0);
  });
});

describe("withQueuedProgress", () => {
  const q = (entries: [string, number][]) => new Map(entries);

  it("a queued tap counts: the ring and 'N of M done' include it", () => {
    const habits = [h("read", "done"), h("water", "open"), h("run", "open")];
    expect(todayProgress(withQueuedProgress(habits, q([["water", 1]])))).toMatchObject({ done: 2, total: 3 });
    expect(todayProgress(withQueuedProgress(habits, q([["water", 1], ["run", 1]]))).done).toBe(3);
  });

  it("never past the target, and only as many taps as it takes", () => {
    const water = { ...h("water", "open"), target_count: 3, done_count: 1 };
    expect(todayProgress(withQueuedProgress([water], q([["water", 1]]))).done).toBe(0);
    expect(todayProgress(withQueuedProgress([water], q([["water", 5]]))).done).toBe(1);
  });

  it("a weekly habit tapped today is done for today", () => {
    const weekly = { ...h("walk", "open", "week"), target_count: 3 };
    const [shown] = withQueuedProgress([weekly], q([["walk", 1]]));
    expect(shown).toMatchObject({ done_count: 1, checked_in_today: true });
    expect(todayProgress([shown]).done).toBe(1);
  });

  it("a queued tap on an approval habit waits for a yes: not done, no early 'all done'", () => {
    const gym = { ...h("gym", "open"), requires_approval: true };
    const p = todayProgress(withQueuedProgress([h("read", "done"), gym], q([["gym", 1]])));
    expect(p).toMatchObject({ done: 1, total: 2 });
  });

  it("someone else's queued taps (a child's, keyed with their id) don't count here", () => {
    expect(todayProgress(withQueuedProgress([h("read", "open")], q([["read/kid-1", 1]]))).done).toBe(0);
  });
});

describe("withQueuedProgress with waiting undos and taps the page already has", () => {
  const q = (entries: [string, number][]) => new Map(entries);

  it("a waiting undo of a counted tap shows a daily habit open again", () => {
    const [shown] = withQueuedProgress([h("read", "done")], q([["read", -1]]));
    expect(shown).toMatchObject({ done_count: 0, checked_in_today: false });
    expect(todayProgress([shown]).done).toBe(0);
  });

  it("a 3-a-day habit keeps its other taps today", () => {
    const water = { ...h("water", "open"), target_count: 3, done_count: 2, checked_in_today: true };
    const [shown] = withQueuedProgress([water], q([["water", -1]]));
    expect(shown).toMatchObject({ done_count: 1, checked_in_today: true });
  });

  it("an approval habit gives back the waiting check-in first", () => {
    const gym = { ...h("gym", "open"), requires_approval: true, checked_in_today: true, pending_count: 1 };
    const [shown] = withQueuedProgress([gym], q([["gym", -1]]));
    expect(shown).toMatchObject({ done_count: 0, pending_count: 0, checked_in_today: false });
  });

  it("a weekly habit is open again today, keeping earlier check-ins", () => {
    const walk = { ...h("walk", "open", "week"), target_count: 3, done_count: 2, checked_in_today: true };
    expect(withQueuedProgress([walk], q([["walk", -1]]))[0]).toMatchObject({ done_count: 1, checked_in_today: false });
  });

  it("never below zero", () => {
    expect(withQueuedProgress([h("read", "open")], q([["read", -1]]))[0]).toMatchObject({ done_count: 0 });
  });

  it("a tap that reached the server before the page was drawn isn't counted twice", () => {
    const water = { ...h("water", "open"), target_count: 3, done_count: 1, checked_in_today: true };
    const tap: QueuedCheckIn = { kind: "check_in", clientId: "a", habitId: "water", subjectId: null, tappedAt: "2026-10-05T08:00:00.000Z", maybeSent: true };
    expect(withQueuedProgress([water], queuedDelta([tap], new Set(["a"])))[0]).toMatchObject({ done_count: 1 });
    expect(withQueuedProgress([water], queuedDelta([tap], new Set()))[0]).toMatchObject({ done_count: 2 });
  });
});

describe("withQueuedProgress keyed by the shown period", () => {
  // Today in Rome is Tue 6 Oct; the week (Monday start) began on Mon 5 Oct.
  const periods = new Map([
    ["read", { start: "2026-10-06", timeZone: "Europe/Rome" }],
    ["walk", { start: "2026-10-05", timeZone: "Europe/Rome" }],
  ]);
  const tap = (habitId: string, tappedAt: string): QueuedCheckIn => ({ kind: "check_in", clientId: `${habitId}-${tappedAt}`, habitId, subjectId: null, tappedAt });

  it("a late tap from yesterday, still waiting, doesn't make today's daily habit done", () => {
    // 23:50 on Mon 5 Oct in Rome (21:50 UTC).
    const [shown] = withQueuedProgress([h("read", "open")], queuedDelta([tap("read", "2026-10-05T21:50:00.000Z")], new Set(), periods));
    expect(shown).toMatchObject({ done_count: 0, checked_in_today: false });
  });

  it("a tap made today counts, also just after local midnight", () => {
    // 00:10 on Tue 6 Oct in Rome is still 5 Oct in UTC.
    const [shown] = withQueuedProgress([h("read", "open")], queuedDelta([tap("read", "2026-10-05T22:10:00.000Z")], new Set(), periods));
    expect(shown).toMatchObject({ done_count: 1, checked_in_today: true });
  });

  it("a weekly habit counts this week's waiting taps, not last week's", () => {
    const walk = { ...h("walk", "open", "week"), target_count: 3 };
    const q = [tap("walk", "2026-10-04T18:00:00.000Z"), tap("walk", "2026-10-05T07:00:00.000Z")];
    expect(withQueuedProgress([walk], queuedDelta(q, new Set(), periods))[0]).toMatchObject({ done_count: 1 });
  });
});

