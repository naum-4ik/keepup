import { describe, expect, it, vi } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { checkedInText, showCheckedIn, showCheckedInWithout, undoCheckIn, undoOutcome, type UndoDeps } from "@/lib/check-in-undo";
import type { ToastAction } from "@/lib/toast";

const FSI = "⁨";
const PDI = "⁩";
const tap = { habitId: "h1", clientId: "c1", title: "Walk", approval: false };

type Shown = { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean };
// The module keeps the ids it showed across calls; each setup's ids are its own, so one test's leftovers
// never match another's ids.
let run = 0;
function setup(undo: UndoDeps["undo"], onUndone?: UndoDeps["onUndone"]) {
  const r = ++run;
  const shown: Shown[] = [];
  const closed: string[] = [];
  let n = 0;
  const deps: UndoDeps = { t: tEn, show: (x) => void shown.push(x), close: (id) => void closed.push(id), undo, onUndone, newId: () => `r${r}t${++n}` };
  return { deps, shown, closed };
}

describe("check-in toast", () => {
  it("says the habit is checked in (isolated), or sent for approval", () => {
    expect(checkedInText(tEn, "Walk", false)).toBe(`${FSI}Walk${PDI} checked in`);
    expect(checkedInText(tEn, "Walk", true)).toBe(`${FSI}Walk${PDI}: sent for approval`);
    expect(checkedInText(tFor("ru"), "Прогулка", false)).toBe(`${FSI}Прогулка${PDI}: отмечено`);
  });

  it("carries Undo, which undoes this tap by its client id", async () => {
    const undo = vi.fn(async () => ({ ok: true as const }));
    const { deps, shown } = setup(undo);
    showCheckedIn(deps, tap);
    const action = shown[0].action;
    expect(action && "onAction" in action && action.label).toBe("Undo");
    if (action && "onAction" in action) action.onAction();
    await vi.waitFor(() => expect(undo).toHaveBeenCalledWith("c1", "h1"));
  });
});

describe("one toast at a time", () => {
  it("a new check-in replaces the last one's toast; Undo replaces whichever is showing", async () => {
    const { deps, shown, closed } = setup(async () => ({ ok: true }));
    showCheckedIn(deps, tap);
    showCheckedIn(deps, { ...tap, habitId: "h2", clientId: "c2", title: "Read" });
    expect(closed).toContain(shown[0].id);
    const second = shown[1];
    expect(closed).not.toContain(second.id);
    await undoCheckIn(deps, tap);
    // The second tap's toast closed before "Undoing…" showed, and "Undoing…" before the answer.
    expect(closed).toContain(second.id);
    expect(closed).toContain(shown[2].id);
    expect(shown.at(-1)?.text).toBe(`${FSI}Walk${PDI}: check-in undone`);
  });
});

describe("Me + Mary", () => {
  it("says checked in, without Undo, and replaces the last check-in toast", () => {
    const { deps, shown, closed } = setup(async () => ({ ok: true }));
    showCheckedIn(deps, tap);
    showCheckedInWithout(deps, "Family dinner");
    expect(closed).toContain(shown[0].id);
    expect(shown[1]).toEqual({ id: shown[1].id, text: `${FSI}Family dinner${PDI} checked in` });
  });
});

describe("undoCheckIn", () => {
  it("shows Undoing… while it runs, closes it, then confirms", async () => {
    let answer!: (r: { ok: true }) => void;
    const { deps, shown, closed } = setup(() => new Promise((r) => (answer = r)));
    const done = undoCheckIn(deps, tap);
    expect(shown).toEqual([{ id: expect.stringMatching(/t1$/), text: `Undoing ${FSI}Walk${PDI}…`, sticky: true }]);
    answer({ ok: true });
    expect(await done).toBe("undone");
    expect(closed.at(-1)).toBe(shown[0].id);
    expect(shown[1]).toEqual({ id: expect.stringMatching(/t2$/), text: `${FSI}Walk${PDI}: check-in undone` });
  });

  it("no answer (offline): says what to do and offers Undo again", async () => {
    const undo = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true });
    const { deps, shown } = setup(undo);
    expect(await undoCheckIn(deps, tap)).toBe("failed");
    const failed = shown[1];
    expect(failed.text).toBe(`Couldn't undo ${FSI}Walk${PDI}. Check your connection and tap Undo again.`);
    expect(failed.action && "onAction" in failed.action && failed.action.label).toBe("Undo");
    if (failed.action && "onAction" in failed.action) failed.action.onAction();
    await vi.waitFor(() => expect(shown.at(-1)?.text).toBe(`${FSI}Walk${PDI}: check-in undone`));
    expect(undo).toHaveBeenCalledTimes(2);
  });

  it("a refusal shows the server's words, with Undo to try again", async () => {
    const { deps, shown } = setup(async () => ({ ok: false, message: "Something went wrong. Try again." }));
    expect(await undoCheckIn(deps, tap)).toBe("failed");
    expect(shown[1].text).toBe("Something went wrong. Try again.");
    expect(shown[1].action && "onAction" in shown[1].action).toBe(true);
  });

  it("nothing left to undo: says so and opens the habit", async () => {
    const message = tEn("today.undo.gone");
    const { deps, shown } = setup(async () => ({ ok: false, message, code: "undo_gone" }));
    expect(await undoCheckIn(deps, tap)).toBe("gone");
    expect(shown[1]).toEqual({ id: expect.stringMatching(/t2$/), text: message, action: { label: "Open habit", href: "/habits/h1" }, focusAction: true });
  });

  it("undone: gives focus back to the habit's check-in button", async () => {
    const onUndone = vi.fn();
    const { deps } = setup(async () => ({ ok: true }), onUndone);
    await undoCheckIn(deps, tap);
    expect(onUndone).toHaveBeenCalledWith("h1");
  });

  it("failed or refused: the next step's action takes focus; nothing is focused back", async () => {
    const onUndone = vi.fn();
    const failed = setup(async () => { throw new Error("network"); }, onUndone);
    await undoCheckIn(failed.deps, tap);
    expect(failed.shown[1].focusAction).toBe(true);
    const gone = setup(async () => ({ ok: false, message: "x", code: "undo_gone" }), onUndone);
    await undoCheckIn(gone.deps, tap);
    expect(gone.shown[1].focusAction).toBe(true);
    expect(onUndone).not.toHaveBeenCalled();
  });

  it("an answer that comes after a newer check-in's toast doesn't close that toast", async () => {
    let answer!: (r: { ok: true }) => void;
    const { deps, shown, closed } = setup(() => new Promise((r) => (answer = r)));
    const done = undoCheckIn(deps, tap);
    showCheckedIn(deps, { ...tap, habitId: "h2", clientId: "c2", title: "Read" }); // a new tap meanwhile
    const newer = shown.at(-1)!;
    answer({ ok: true });
    await done;
    expect(closed).not.toContain(newer.id);
    expect(shown.at(-1)?.text).toBe(`${FSI}Walk${PDI}: check-in undone`);
  });
});

describe("undoOutcome", () => {
  it("true is undone; false with the row gone is already undone; false with the row there, or unknown, is refused", () => {
    expect(undoOutcome(true, null)).toBe("undone");
    expect(undoOutcome(false, false)).toBe("already");
    expect(undoOutcome(false, true)).toBe("refused");
    expect(undoOutcome(false, null)).toBe("refused");
  });
});
