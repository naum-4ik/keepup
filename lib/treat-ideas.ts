// Treat goal suggestions (ideas/achievements-and-rewards.md §8): tap one to fill the form, or write your own.
export const TREAT_IDEAS = [
  { emoji: "🍦", title: "Ice cream at the park" },
  { emoji: "🛝", title: "Trip to the playground" },
  { emoji: "🎬", title: "Family movie night" },
  { emoji: "🍕", title: "Pizza night" },
  { emoji: "🧁", title: "Bake cupcakes together" },
  { emoji: "🥞", title: "Pancake breakfast" },
  { emoji: "🦁", title: "Trip to the zoo" },
  { emoji: "🏊", title: "Swimming at the pool" },
  { emoji: "🚲", title: "Bike ride together" },
  { emoji: "🧺", title: "Picnic in the park" },
  { emoji: "📚", title: "A new book" },
  { emoji: "🎨", title: "New art supplies" },
  { emoji: "🦖", title: "A small new toy" },
  { emoji: "🎮", title: "Extra game time" },
  { emoji: "🎡", title: "A day at the fair" },
  { emoji: "🌙", title: "Stay up late on Friday" },
] as const;

export const TREAT_EMOJI = ["🎁", ...new Set(TREAT_IDEAS.map((i) => i.emoji)), "🎈", "⭐"] as const;
