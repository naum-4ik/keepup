import type { T } from "@/supabase/functions/_shared/i18n";

// Treat goal suggestions (ideas/achievements-and-rewards.md §8): tap one to fill the form, or write your own.
export const TREAT_IDEAS = [
  { id: "ice-cream", emoji: "🍦" },
  { id: "playground", emoji: "🛝" },
  { id: "movie-night", emoji: "🎬" },
  { id: "pizza-night", emoji: "🍕" },
  { id: "cupcakes", emoji: "🧁" },
  { id: "pancakes", emoji: "🥞" },
  { id: "zoo", emoji: "🦁" },
  { id: "swimming", emoji: "🏊" },
  { id: "bike-ride", emoji: "🚲" },
  { id: "picnic", emoji: "🧺" },
  { id: "new-book", emoji: "📚" },
  { id: "art-supplies", emoji: "🎨" },
  { id: "small-toy", emoji: "🦖" },
  { id: "game-time", emoji: "🎮" },
  { id: "fair", emoji: "🎡" },
  { id: "late-friday", emoji: "🌙" },
] as const;

// The idea's title, in the reader's language (templates.treat.<id>).
export const treatTitle = (t: T, id: string): string => t(`templates.treat.${id}`);

export const TREAT_EMOJI = ["🎁", ...new Set(TREAT_IDEAS.map((i) => i.emoji)), "🎈", "⭐"] as const;
