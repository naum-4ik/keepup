# Keepup design

Soft, warm, made for families. Calm by default, joyful where it rewards you.

## Principles

1. **Today first.** The main screen answers one question: what's left to do today? Everything else is one tap away.
2. **One thumb.** Primary actions sit in the bottom half of the screen. Tap targets are at least 44×44 px.
3. **Quiet until it matters.** Warm neutral surfaces, one accent color. Color and motion are saved for progress: a check-in, a streak, a level-up.
4. **Never guilt.** Missed days are stated plainly, never shamed. Group messages never name who missed.
5. **Color is never the only signal.** Every status and category also has an icon or a label.

## Wordmark

"Keepup" is written as **Keep** (foreground) + **up** (terracotta), one word, no space. The highlighted "up" carries the meaning: keep going. Tagline: *Habits, together.*

## Color

Soft and warm: cream surfaces, warm-brown text, one terracotta accent, pastel category chips. Values are sRGB hex; tokens map to shadcn CSS variables.

### Base

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFF8F0` cream | `#1F1915` | Page |
| `card` | `#FFFFFF` | `#2A221C` | Cards, sheets |
| `foreground` | `#3D2C22` warm brown | `#F5EDE4` | Main text (12.6:1 / 15:1) |
| `muted-foreground` | `#7A6556` | `#B8A596` | Secondary text (5.2:1 / 7.3:1) |
| `border` | `#EFE3D6` | `#3A2F27` | Dividers, inputs |

### Accent: Terracotta

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#B84F33` | `#F0A07F` | Primary buttons, active nav, links (4.7:1 on cream) |
| `primary-foreground` | `#FFFFFF` | `#2A221C` | Text on primary (5.0:1 / 7.5:1) |
| `flame` | `#E8804F` | `#F0A07F` | Streak 🔥 icon and count only (not body text) |

### Status

Soft tones; always paired with an icon.

| Status | Color | Icon |
|---|---|---|
| Done | `#4F8A5B` sage | check |
| Pending approval | `#D4A017` honey | clock |
| Frozen | `#5B8DB8` soft blue | snowflake |
| Missed / destructive | `#C0392B` | x |

### Categories

Pastel chip background with a deeper icon color, always with the icon.

| Category | Chip | Icon color | Icon |
|---|---|---|---|
| Health | `#E3F1FA` | `#3B82B8` | heart-pulse |
| Fitness | `#E5F2E6` | `#4F8A5B` | footprints |
| Mind | `#EEE8F8` | `#7B61B0` | sun |
| Learning | `#FBF3D9` | `#B08A1E` | book-open |
| People | `#FBE6E8` | `#C2505F` | users |
| Home | `#E0F3EF` | `#3A8C7E` | house |
| Money | `#F1EADF` | `#8A6B45` | wallet |
| Break a habit | `#F0ECE8` | `#8A7F76` | shield-ban |

Icons come from `lucide-react` (rounded line style). **Kid habits** use picture emoji a child recognizes (🪥 brush teeth, 🧸 tidy toys, 📖 read, 🛁 bath, 🥦 eat veggies, 😴 bedtime), chosen from a curated kid set, shown large in a pastel circle. Emoji only in copy (🔥 in the streak count) and in avatars, never as UI icons.

## Typography

- **Font:** Nunito (rounded, friendly) for all UI text via `next/font/google`; Geist Mono only for the version label.
- **Scale:** 12 (captions) · 14 (secondary) · 16 (body, inputs) · 20 (section titles) · 24 (page titles) · 32 (big numbers: streaks, level).
- **Numbers** that change (streaks, XP, progress) use `tabular-nums` so they don't jump.
- **Weights:** 400 body, 600 labels and buttons, 700 titles.

## Layout and shape

- **Grid:** 4 px. Common gaps: 8, 12, 16, 24.
- **Page padding:** 16 px sides. Content max width 448 px (phone column), centered on larger screens.
- **Radius:** 16 px cards, 12 px inputs and buttons, full circle for avatars, chips and the check-in button.
- **Elevation:** soft warm shadow on cards: `0 1px 2px rgb(61 44 34 / 0.06), 0 4px 12px rgb(61 44 34 / 0.05)`. No hard borders on cards.
- **Empty states:** a small line icon in a pastel circle plus one friendly sentence. No mascots.
- **Safe areas:** header and bottom nav respect `env(safe-area-inset-*)`.

## Motion

- **Durations:** 150–250 ms, ease-out.
- **Check-in:** the button fills, a short pop, "+10 XP" floats up and fades.
- **Confetti:** only for level-up and achievement unlocked, once each.
- **Reduced motion:** with `prefers-reduced-motion`, keep the state change and drop the animation.

## App icon

A filled terracotta sprout on a peach square, drawn bold enough to read at 16 px. In-app sprouts (the Today empty state) use the same drawing via `components/sprout-icon.tsx`, never lucide's `Sprout`.

| Element | Color |
|---|---|
| Square | peach `#FDE3D3`, edge `#F6D2BE` |
| Sprout, stem, ground | terracotta `#B84F33` |

Master artwork (`app/icon.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FDE3D3" stroke="#F6D2BE" stroke-width="1.5"/>
  <path d="M20 51 L44 51" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 51 C33 44 31 38 33 29" fill="none" stroke="#B84F33" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 38 C22 38 16 32 14 23 C23 22 30 28 31 38 Z" fill="#B84F33"/>
  <path d="M33 31 C33 21 39 14 50 13 C51 23 44 30 33 31 Z" fill="#B84F33"/>
</svg>
```

- **Every size comes from the master.** `app/favicon.ico` (16, 32, 48), `app/apple-icon.png` (180), and `public/icons/` (192, 512, maskable 512) are rendered from it by a script, never drawn by hand.
- **The iOS icon is full-bleed; the OS rounds it.** `apple-icon.png` has no rounded corners and no edge.
- **Maskable:** full-bleed peach, with the sprout at about 70% so it stays inside the safe zone.

## Voice

Short, warm, direct. Second person. No exclamation-mark spam.

| Instead of | Write |
|---|---|
| "You failed to complete your habit!" | "Read: not done yesterday." |
| "Dan broke the family streak" | "Family dinner streak ended at 6 weeks." |
| "Congratulations!!! You have unlocked…" | "Unlocked: Bookworm 📚" |

## Avoid

- Cartoon or RPG styling (mascots, pixel art, avatars with gear).
- Gradients, glassmorphism, neon, cold grays and pure black.
- More than one accent color on a screen, apart from category chips.
- Red for anything but errors and destructive actions.
- Guilt copy, countdown pressure, or naming who broke a group streak.
- Tiny tap targets, text below 4.5:1 contrast.
- Photos of people (GDPR, and kids). Avatars are an emoji chosen from a curated set (animals, friendly objects) on a pastel circle; until chosen, the initial.
- Toasts for things the screen already shows.
