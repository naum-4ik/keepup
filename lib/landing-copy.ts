import { TRY_IT } from "@/lib/demo-copy";

// The landing page's lines (M6 PR 4), from the owner's landing note. Voice: short, warm, no hype;
// lib/landing-copy.test.ts checks them.
export const LANDING = {
  hero: {
    sub: "Keep up your habits, and do the ones that matter with your family.",
    primary: TRY_IT,
    secondary: "Get started",
    signIn: "Sign in",
  },
  sections: [
    {
      key: "habits",
      title: "Your habits",
      body: "Pick from ready-made habits or make your own. Check in with one tap; watch your streaks grow.",
      image: "/landing/today.png",
      alt: "Keepup's Today screen: a ring of today's habits and one-tap check-ins",
    },
    {
      key: "together",
      title: "Together",
      body: "Share habits with your family: family dinner, walks, date night. Done when everyone's done. Cheer each other on.",
      image: "/landing/family.png",
      alt: "A family habit in Keepup: Family dinner, with who has done it this week",
    },
    {
      key: "kids",
      title: "For kids",
      body: "Kids get stars that grow a garden. Parents log it for the little ones.",
      image: "/landing/kid.png",
      alt: "A child's view in Keepup: big picture habits and a garden that grows with each star",
    },
  ],
  privacy: {
    title: "Private by design",
    // Not "no tracking": traces (user ID, email, clicks) go to Grafana for fixing bugs (#157).
    // The last point becomes a link to /privacy once that page exists (M6 PR 7).
    points: [
      "No ads. Nothing sold or shared for marketing.",
      "Kids are a nickname only, never photos.",
      "Your private habits are only yours.",
      "Export or delete your data anytime.",
    ],
  },
  footer: {
    builtBy: "Built by Ilya",
    github: "https://github.com/naum-4ik/keepup",
    architecture: "https://github.com/naum-4ik/keepup/blob/develop/docs/architecture.md",
  },
} as const satisfies {
  hero: { sub: string; primary: string; secondary: string; signIn: string };
  sections: readonly { key: "habits" | "together" | "kids"; title: string; body: string; image: string; alt: string }[];
  privacy: { title: string; points: readonly string[] };
  footer: { builtBy: string; github: string; architecture: string };
};
