import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { markup, richEn, tEn } from "./test-t";

// PR 7 prep: messages restructured so ru/he can be written without code changes. Each case pins the
// English the code produced before the change (built from pieces then, one message now).
const sr = (c: ReactNode) => createElement("span", { className: "sr-only" }, c);

describe("lists and separators are catalog words", () => {
  it("joins lists with the catalog separator", () => {
    expect(["A done", "B to do"].join(tEn("common.listSeparator"))).toBe("A done, B to do");
    expect(tEn("celebrations.habitSeparator")).toBe(" · ");
  });

  it("Progress row: ended note, schedule and best streak in one message", () => {
    const line = (ended: boolean, best: string | null) =>
      tEn("progress.habitLine", { ended: ended ? "yes" : "no", schedule: "daily", best: best ? "yes" : "no", span: best ?? "" });
    expect(line(false, null)).toBe("daily");
    expect(line(false, "5 days")).toBe("daily · best 5 days");
    expect(line(true, null)).toBe("Ended · decide on Today · daily");
    expect(line(true, "2 weeks")).toBe("Ended · decide on Today · daily · best 2 weeks");
  });

  it("habit page subtitle carries Archived inside the message", () => {
    expect(tEn("habits.detail.scheduleLine", { schedule: "daily", archived: "no" })).toBe("daily");
    expect(tEn("habits.detail.scheduleLine", { schedule: "daily", archived: "yes" })).toBe("daily · Archived");
    expect(tEn("habits.detail.categoryLine", { schedule: "daily", category: "Health", archived: "yes" })).toBe("daily · Health · Archived");
    expect(markup(richEn("habits.detail.groupLine", { group: "Levis", schedule: "weekly", approval: "yes", archived: "yes" })))
      .toBe("<bdi>Levis</bdi> · weekly · needs approval · Archived");
    expect(markup(richEn("habits.detail.groupLine", { group: "Levis", schedule: "weekly", approval: "no", archived: "no" })))
      .toBe("<bdi>Levis</bdi> · weekly");
  });

  it("Needs a connection names the card for screen readers in one message", () => {
    expect(markup(richEn("offline.needsConnectionFor", { label: "Invite", sr })))
      .toBe('Needs a connection<span class="sr-only">: Invite</span>');
  });
});
