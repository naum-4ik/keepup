// What's new, written for people using Keepup (CHANGELOG.md stays the developer log, owned by
// release-please). Each release: add an entry at the top with 3–5 plain lines about what people
// can now do. No PR numbers, hashes or internals; never guilt; kid copy stays gender-neutral.
// Add the date once the release merges; until then a version newer than the app's says "Coming soon".
export type Release = { version: string; date?: string; notes: string[] };

// > 0 when a is newer than b ("0.10.0" vs "0.9.1").
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function releaseLabel(r: Release, appVersion: string): string {
  const [y, m, d] = (r.date ?? "").split("-").map(Number);
  if (r.date) return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
  return compareVersions(r.version, appVersion) > 0 ? "Coming soon" : "";
}

export const RELEASES: Release[] = [
  {
    version: "0.5.0",
    notes: [
      "Keepup is now an app: add it to your Home Screen and it opens full screen with the sprout icon.",
      "Reminders: one daily summary at the hour you choose, or a habit's own time with “Remind me at…”. For each kind, pick Sound, Silent or Inbox only.",
      "Your group's check-ins, approvals and nudges now reach your phone, and you choose which ones.",
      "No signal? Check in anyway. It's saved on your phone and counts for the day you tapped, once you're back online.",
      "In the kid view, the picture stays in sight and moves gently.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-01",
    notes: [
      "Keep habits together: make a group for your family or friends, invite them with a link, and share habits you all check in on.",
      "Add your kids, no account needed. They tap their own habits, earn stars, grow a garden (or an aquarium, space, dino or town), and save up for treats you choose together.",
      "A new Inbox for cheers, gentle nudges and check-ins waiting for your OK.",
      "Give a habit an end, like 30 days, and see “Day 12 of 30” as you go. At the end, keep going or call it finished.",
      "See your progress on a calendar, month by month, and tap any day to see what you did. Plus: sign up with email and a password, and pick an avatar for you and your group.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-29",
    notes: [
      "Add habits from ready-made ideas or make your own, each with its own emoji.",
      "Check in from Today: what's left comes first, then what's done.",
      "Pause a habit when life gets busy, without losing your streak.",
      "Every habit has its own page with its history, streaks and settings.",
      "Progress shows how your week is going, and you can choose whether weeks start on Sunday or Monday.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-29",
    notes: ["A calmer sign-in page, with a proper Google button.", "Sign out now lives on your Profile."],
  },
  {
    version: "0.1.0",
    date: "2026-09-28",
    notes: ["Keepup's first version: sign in, tell us a little about you, and set your time zone."],
  },
];
