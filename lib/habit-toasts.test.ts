import { describe, expect, it, vi } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import {
  addedFlash, deletedFlash, HABIT_FLASH_KEYS, restoredFlash, RESTORE_TIMEOUT_MS, showArchived, startedAgainFlash, undoArchive,
  type ArchiveUndoDeps,
} from "@/lib/habit-toasts";
import { parseFlash, serializeFlash, type Flash, type ToastAction } from "@/lib/toast";
import type { Locale } from "@/supabase/functions/_shared/i18n";

const FSI = "⁨";
const PDI = "⁩";
const LOCALES: Locale[] = ["en", "ru", "he"];
// As the Toaster says it: the text and the action label translated with the flash's values.
const say = (f: Omit<Flash, "id" | "at">, locale: Locale = "en") => {
  const t = tFor(locale);
  return { text: t(f.text, f.values), action: f.action && { label: t(f.action.label), href: f.action.href } };
};

describe("habit flash toasts", () => {
  it("names only keys that every catalog has (the Toaster drops unknown ones silently)", () => {
    for (const locale of LOCALES) for (const key of Object.values(HABIT_FLASH_KEYS)) expect(() => tFor(locale)(key, { habit: "x", period: "day", starts: "now", date: "" })).not.toThrow();
  });

  it("survives the cookie: keys, values and the in-app link", () => {
    const f = addedFlash({ id: "h1", title: "Read", period: "day" }, "en");
    expect(parseFlash(serializeFlash({ id: "f", at: 1, ...f }))).toEqual({ id: "f", at: 1, ...f });
  });

  it("added: check in now to start day 1, with the habit to open; a start ahead says when", () => {
    expect(say(addedFlash({ id: "h1", title: "Read", period: "day" }, "en"))).toEqual({
      text: `Added ${FSI}Read${PDI} · check in now to start day 1`,
      action: { label: "Open", href: "/habits/h1" },
    });
    expect(say(addedFlash({ id: "h1", title: "Run", period: "week", startsOn: "" }, "en")).text).toBe(`Added ${FSI}Run${PDI} · check in now to start week 1`);
    expect(say(addedFlash({ id: "h1", title: "Read", period: "day", startsOn: "2026-10-26" }, "en")).text).toBe(`Added ${FSI}Read${PDI}. It starts Mon 26 Oct.`);
    expect(addedFlash({ title: "Read", period: "day" }, "en").action).toBeUndefined();
    expect(say(addedFlash({ id: "h1", title: "Чтение", period: "month" }, "ru"), "ru").text).toBe(`Добавлено: ${FSI}Чтение${PDI} · отметьтесь сейчас, чтобы начать месяц 1`);
  });

  it("deleted: no undo and no link, and says nothing was lost", () => {
    expect(say(deletedFlash("Read"))).toEqual({ text: `Deleted ${FSI}Read${PDI}. It had no check-ins, so nothing was lost.`, action: undefined });
  });

  it("restored and started again open the habit", () => {
    expect(say(restoredFlash({ id: "h1", title: "Read" }))).toEqual({
      text: `Restored ${FSI}Read${PDI}, history kept. The archived days don't count against you.`,
      action: { label: "Open", href: "/habits/h1" },
    });
    expect(say(startedAgainFlash({ id: "h2", title: "Read" })).action).toEqual({ label: "Open", href: "/habits/h2" });
    expect(say(startedAgainFlash({ title: "קריאה" }), "he").text).toContain(`${FSI}קריאה${PDI}`);
  });
});

type Shown = { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean };
let run = 0;
function setup(restore: ArchiveUndoDeps["restore"], timeoutMs?: number) {
  const r = ++run;
  const shown: Shown[] = [];
  const closed: string[] = [];
  let n = 0;
  const deps: ArchiveUndoDeps = { t: tEn, show: (x) => void shown.push(x), close: (id) => void closed.push(id), restore, newId: () => `a${r}t${++n}`, timeoutMs };
  return { deps, shown, closed };
}
const habit = { habitId: "h1", title: "Read" };
const tapAction = (s: Shown) => (s.action && "onAction" in s.action ? s.action.onAction() : undefined);

describe("archive toast with Undo", () => {
  it("says it is archived and where its history is, with Undo", () => {
    const { deps, shown } = setup(async () => ({ ok: true }));
    showArchived(deps, habit);
    expect(shown[0].text).toBe(`Archived ${FSI}Read${PDI}. Its history is in Progress → Archived.`);
    expect(shown[0].action?.label).toBe("Undo");
  });

  it("a child's own habit says it is in the child's Archived (isolated)", () => {
    const { deps, shown } = setup(async () => ({ ok: true }));
    showArchived(deps, { ...habit, child: { id: "k1", name: "Mary" } });
    expect(shown[0].text).toBe(`Archived ${FSI}Read${PDI}. Its history is in ${FSI}Mary${PDI}'s Archived.`);
    showArchived({ ...deps, t: tFor("ru") }, { ...habit, child: { id: "k1", name: "Маша" } });
    expect(shown[1].text).toBe(`${FSI}Read${PDI}: в архиве. История — в разделе «Архив» у ${FSI}Маша${PDI}.`);
  });

  it("Undo: Restoring… (sticky, replacing the archived toast), then back with a link to open it", async () => {
    const restore = vi.fn(async () => ({ ok: true as const }));
    const { deps, shown, closed } = setup(restore);
    showArchived(deps, habit);
    expect(await undoArchive(deps, habit)).toBe("restored");
    expect(restore).toHaveBeenCalledWith("h1");
    expect(shown[1]).toEqual({ id: shown[1].id, text: `Restoring ${FSI}Read${PDI}…`, sticky: true });
    expect(closed).toContain(shown[0].id);
    expect(closed).toContain(shown[1].id);
    expect(shown[2]).toEqual({ id: shown[2].id, text: `${FSI}Read${PDI} is back, history kept.`, action: { label: "Open", href: "/habits/h1" } });
  });

  it("no answer: says to check the connection, with Undo again that can succeed", async () => {
    let calls = 0;
    const { deps, shown } = setup(async () => {
      if (++calls === 1) throw new Error("offline");
      return { ok: true };
    });
    expect(await undoArchive(deps, habit)).toBe("failed");
    const failed = shown.at(-1)!;
    expect(failed.text).toBe(`Couldn't restore ${FSI}Read${PDI}. Check your connection and tap Undo again.`);
    expect(failed.focusAction).toBe(true);
    tapAction(failed);
    await vi.waitFor(() => expect(shown.at(-1)!.text).toBe(`${FSI}Read${PDI} is back, history kept.`));
  });

  it("refused: the server's reason, with Undo again", async () => {
    const { deps, shown } = setup(async () => ({ ok: false, message: "Only a group admin can do that." }));
    expect(await undoArchive(deps, habit)).toBe("failed");
    expect(shown.at(-1)!.text).toBe("Only a group admin can do that.");
    expect(shown.at(-1)!.action?.label).toBe("Undo");
  });

  it("a hung request gives up after the timeout and offers Undo again", async () => {
    vi.useFakeTimers();
    try {
      const { deps, shown } = setup(() => new Promise(() => {}));
      const done = undoArchive(deps, habit);
      await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS);
      expect(await done).toBe("failed");
      expect(shown.at(-1)!.text).toContain("Check your connection");
    } finally {
      vi.useRealTimers();
    }
  });
});
