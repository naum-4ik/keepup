import { describe, expect, it } from "vitest";
import { chooseGentleCard, milestoneToday, recapLine, recapKey, visibleRecaps } from "@/lib/today-cards";

const base = { purpose: "family" as const, hasCheckedIn: true, groups: [], dismissed: new Set<string>(), milestoneToday: false };

describe("chooseGentleCard", () => {
  it("waits for the first check-in", () => {
    expect(chooseGentleCard({ ...base, hasCheckedIn: false })).toBeNull();
  });
  it("invites family or a friend by purpose, only without groups", () => {
    expect(chooseGentleCard(base)).toEqual({ key: "invite_family" });
    expect(chooseGentleCard({ ...base, purpose: "friends" })).toEqual({ key: "invite_friend" });
    expect(chooseGentleCard({ ...base, purpose: "me" })).toBeNull();
    expect(chooseGentleCard({ ...base, purpose: null })).toBeNull();
  });
  it("offers Add a child for a family group the user admins, with no children yet", () => {
    const groups = [{ group_id: "g1", kind: "family", role: "admin", child_count: 0 }];
    expect(chooseGentleCard({ ...base, groups })).toEqual({ key: "add_child:g1", groupId: "g1" });
    expect(chooseGentleCard({ ...base, groups: [{ ...groups[0], role: "member" }] })).toBeNull();
    expect(chooseGentleCard({ ...base, groups: [{ ...groups[0], child_count: 1 }] })).toBeNull();
    expect(chooseGentleCard({ ...base, groups: [{ ...groups[0], kind: "friends" }] })).toBeNull();
  });
  it("respects dismissals and never shows on a milestone day", () => {
    expect(chooseGentleCard({ ...base, dismissed: new Set(["invite_family"]) })).toBeNull();
    expect(chooseGentleCard({ ...base, milestoneToday: true })).toBeNull();
  });
  it("skips a dismissed Add a child for the next family group", () => {
    const groups = [
      { group_id: "g1", kind: "family", role: "admin", child_count: 0 },
      { group_id: "g2", kind: "family", role: "admin", child_count: 0 },
    ];
    expect(chooseGentleCard({ ...base, groups, dismissed: new Set(["add_child:g1"]) })).toEqual({ key: "add_child:g2", groupId: "g2" });
  });
});

describe("milestoneToday", () => {
  const now = new Date("2026-10-05T21:30:00Z"); // 23:30 in Rome, 06:30 next day in Tokyo
  const m = (o: { seen_at?: string | null; created_at?: string; kind?: string } = {}) => ({
    kind: "group_milestone", seen_at: null, created_at: "2026-10-05T06:00:00Z", ...o,
  });
  it("is true while a milestone card is showing, whatever day it arrived", () => {
    expect(milestoneToday([m()], "Europe/Rome", now)).toBe(true);
    expect(milestoneToday([m({ created_at: "2026-09-20T06:00:00Z" })], "Europe/Rome", now)).toBe(true);
  });
  it("stays true all day after the milestone was seen or dismissed", () => {
    expect(milestoneToday([m({ seen_at: "2026-10-05T07:00:00Z" })], "Europe/Rome", now)).toBe(true);
  });
  it("is false for seen milestones from other days (in the user's time zone) and for other kinds", () => {
    expect(milestoneToday([m({ seen_at: "2026-10-04T07:00:00Z", created_at: "2026-10-04T06:00:00Z" })], "Europe/Rome", now)).toBe(false);
    expect(milestoneToday([m({ seen_at: "2026-10-05T07:00:00Z" })], "Asia/Tokyo", now)).toBe(false);
    expect(milestoneToday([m({ kind: "everyone_done" })], "Europe/Rome", now)).toBe(false);
    expect(milestoneToday([], "Europe/Rome", now)).toBe(false);
  });
});

describe("family recap", () => {
  const recap = {
    group_id: "g1", group_name: "Family", week_start: "2026-09-28", check_ins: 34,
    best_title: "Family dinner", best_emoji: "🍝", best_streak: 5, best_period: "week",
  };
  it("reads as wins only", () => {
    expect(recapLine(recap)).toBe("Together last week: 34 check-ins · Family dinner 5 weeks 🔥");
    expect(recapLine({ ...recap, check_ins: 1, best_streak: 1, best_period: "day" })).toBe("Together last week: 1 check-in · Family dinner 1 day 🔥");
  });
  it("leaves the streak to a milestone card showing for the same group", () => {
    expect(recapLine(recap, true)).toBe("Together last week: 34 check-ins");
  });
  it("leaves out the streak part when there is none", () => {
    expect(recapLine({ ...recap, best_title: null, best_emoji: null, best_streak: null, best_period: null })).toBe("Together last week: 34 check-ins");
  });
  it("hides weeks without check-ins and dismissed ones", () => {
    expect(recapKey(recap)).toBe("family_recap:g1:2026-09-28");
    expect(visibleRecaps([recap, { ...recap, group_id: "g2", check_ins: 0 }], new Set())).toEqual([recap]);
    expect(visibleRecaps([recap], new Set(["family_recap:g1:2026-09-28"]))).toEqual([]);
  });
});
