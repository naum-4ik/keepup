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
    version: "1.0.0",
    notes: [
      "Keepup has its own address: keepuphabits.vercel.app. Curious friends can try the demo without signing up; it's cleared after 24 hours.",
      "Settings → Export my data saves a copy of your data, and Delete account removes your account and your data.",
      "Forgot your password? Reset it by email from the sign-in page. New email sign-ups get a short message to confirm the address.",
      "Any habit can now be archived, even one you never checked in on.",
      "A privacy policy says plainly what Keepup keeps and for how long, including the error and speed reports that help keep the app working.",
    ],
  },
  {
    version: "0.6.1",
    date: "2026-10-07",
    notes: [
      "Settings → Reset my data: start fresh with your own habits, XP and badges. Your family's shared habits and your kids stay as they are.",
      "Undo is more reliable on a slow or flaky connection, also with Keepup open in more than one tab.",
      "Progress → Active no longer lists habits that have reached their end; you'll find them under Finished.",
      "A check-in saved offline yesterday now counts for yesterday, not today.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-06",
    notes: [
      "Every check-in earns XP, and you grow from Seedling to Forest. A ring around your Profile avatar shows the way to the next level, and streak milestones arrive in your Inbox.",
      "24 badges to collect under Profile → Achievements, from First step to Bookworm. Your past check-ins already count.",
      "Rest days: keep a daily habit going for a week and you earn one. Miss a day and it's used for you, so your streak stays safe.",
      "A weekly and monthly recap of your wins, in your Inbox and under Progress → Recaps.",
      "Level-ups and badges get a short celebration (Settings → Celebrations → Subtle for a quieter one). In the kid view, every star now gets a big reveal.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-04",
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
