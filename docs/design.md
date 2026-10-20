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
| `muted-foreground` | `#776253` | `#B8A596` | Secondary text, placeholders (5.5:1 / 7.3:1 on the page; ≥ 4.6:1 on muted, accent, secondary) |
| `border` | `#EFE3D6` | `#3A2F27` | Dividers, card edges: decoration, not 3:1 |
| `input` | `#9C8D7E` | `#7A6C61` | Field borders, the open check-in circle (3.1:1 / 3.1:1: a transparent field's only edge) |

### Accent: Terracotta

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` / `ring` | `#AD4529` | `#F0A07F` | Primary buttons, active nav, links, focus outline (5.5:1 on cream; ≥ 4.6:1 on accent, muted, secondary) |
| `primary-foreground` | `#FFFFFF` | `#2A221C` | Text on primary (5.7:1 / 7.5:1) |
| `flame` | `#B75420` | `#F0A07F` | Streak 🔥 icon and count only, not body text (the count is 14px bold, so 4.6:1 on cream) |

### Status

Soft tones; always paired with an icon. Tokens live in `app/globals.css` (Tailwind: `text-done`, `bg-done-soft`, …); never hardcode hex in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `done` | `#3D7549` sage | `#7FBF8C` | Done text, check icons, filled check-in button (5.5:1 on white; 4.7:1 on `done-soft`) |
| `done-soft` | `#E5F2E6` | `#32392A` | "All done" card, finish card |
| `done-foreground` | `#FFFFFF` | `#1F1915` | Icon or text on a `done` fill |
| `pending` | `#8A5E0C` honey | `#E0B84A` | Pending approval text, clock, border (5.1:1 on `pending-soft`) |
| `pending-soft` | `#FBF3D9` | `#4F3E1B` | Pending chips and notes |
| `frozen` | `#3B6E99` soft blue | `#8FB8DC` | Paused text, snowflake |
| `frozen-soft` | `#E3F1FA` | `#353A3E` | Paused surfaces |
| `flame-soft` | `#FDE6D8` | `#543727` | Peach avatar |
| `destructive` | `#AE261A` | `#F37D6E` | Missed / destructive, with x (≥ 4.6:1 on the page, card and its own `/10`–`/20` tints) |

### Categories

Pastel chip background with a deeper icon color. Category tabs and pickers show the icon; a habit shows its own emoji in the same chip (see below).

| Category | Token | Chip (light / dark) | Icon (light / dark) | Icon |
|---|---|---|---|---|
| Health | `cat-health` | `#E3F1FA` / `#2D353B` | `#3B82B8` / `#7FB0DA` | heart-pulse |
| Fitness | `cat-fitness` | `#E5F2E6` / `#313729` | `#4F8A5B` / `#7FBF8C` | footprints |
| Mind | `cat-mind` | `#EEE8F8` / `#3A2F3A` | `#7B61B0` / `#A992D6` | sun |
| Learning | `cat-learning` | `#FBF3D9` / `#45371C` | `#A57F06` / `#D9B54A` | book-open |
| People | `cat-people` | `#FBE6E8` / `#482B29` | `#C2505F` / `#E0848F` | users |
| Home | `cat-home` | `#E0F3EF` / `#2D3730` | `#3A8C7E` / `#6FC0B0` | house |
| Work & money | `cat-work-money` | `#F1EADF` / `#3D3124` | `#8A6B45` / `#C4A07A` | briefcase-business |
| Break a habit | `cat-break-habit` | `#F0ECE8` / `#3D352E` | `#8A7F76` / `#B5AAA0` | shield-ban |

Use `bg-cat-<name>-soft` for the chip and `text-cat-<name>` for the icon. Dark chips are 20% of the category colour mixed into the warm card (`#2A221C`), so they stay warm, never cold navy. Undone emoji chips fade with `grayscale` and opacity (60% in dark, 40% in light), never a darkening filter.

Icons come from `lucide-react` (rounded line style). **Kid habits** use picture emoji a child recognizes (🪥 brush teeth, 🧸 tidy toys, 📖 read, 🛁 bath, 🥦 eat veggies, 😴 bedtime), chosen from a curated kid set, shown large in a pastel circle. **Habit emoji:** every habit has one emoji (templates bring theirs; "Create your own" picks one, or gets the category default: 🍎 health, 👟 fitness, 🌿 mind, 📚 learning, 💛 people, 🏠 home, 💼 work & money, 🚫 break a habit). It sits inside the category-coloured chip wherever the habit appears (Today, the habit page, Progress), so the colour tells the category and the emoji tells the habit. Otherwise emoji only in copy (🔥 in the streak count) and in avatars, never as UI icons.

### Contrast

WCAG 2.2 AA in light and dark: text 4.5:1 (3:1 only from 24px, or 18.66px bold), UI parts (field borders, the check-in circle, icons that carry meaning, focus outlines) 3:1 against what is next to them. Change a token, never one component: `lib/contrast.test.ts` reads `app/globals.css` and checks every pair the app uses, tints like `bg-destructive/10` included, so a token that drops below fails CI. A new pairing goes into that test.

- Text tints: no `text-*/50` for text people need to read; only disabled controls may fade (they are exempt, but stay legible).
- Destructive button: `bg-destructive/10` (hover `/20` light, `/15` dark); a stronger tint drops the red text below 4.5:1.
- Focus: the solid `ring` (5.5:1 / 7.5:1) is the indicator; the soft `ring/50` halo around fields and buttons is extra.
- Graphics without 3:1 between their steps (the recap heatmap's light shades, history and week dots) always carry a text alternative: `role="img"` with a label, a legend, or the numbers beside them.
- Brand art (app icon, install pictures, emails) keeps `#B84F33`; their text still passes on white.

## Typography

- **Font:** Nunito (rounded, friendly) for all UI text, self-hosted via `next/font/local` (basic Latin preloaded; latin-ext, Cyrillic and Rubik for Hebrew fetched only when a page uses those letters); Geist Mono only for the version label.
- **Scale:** 12 (captions) · 14 (secondary) · 16 (body, inputs) · 20 (section titles) · 24 (page titles) · 32 (big numbers: streaks, level).
- **Numbers** that change (streaks, XP, progress) use `tabular-nums` so they don't jump.
- **Weights:** 400 body, 600 labels and buttons, 700 titles.

## Layout and shape

- **Grid:** 4 px; spacing uses three levels only (below).
- **Page padding:** 16 px sides. Content max width 448 px (phone column), centered on larger screens.
- **Radius:** 16 px cards, 12 px inputs and buttons, full circle for avatars, chips and the check-in button.
- **Elevation:** soft warm shadow on cards: `0 1px 2px rgb(61 44 34 / 0.06), 0 4px 12px rgb(61 44 34 / 0.05)`. No hard borders on cards.
- **Safe areas:** header, bottom nav and the page's bottom padding respect `env(safe-area-inset-*)`.

### Spacing

Three levels, everywhere. Tokens in `app/globals.css` `@theme` (`--spacing-*`), so they are Tailwind utilities.

| Level | Size | Use | Utilities |
|---|---|---|---|
| inner | 8 px | inside one element: icon to label, title to its meta line, chips in a row | `gap-inner`, `p-inner` |
| item | 16 px | between elements: list rows, form fields, cards in a list; a Surface's padding | `gap-item`, `p-item` |
| section | 24 px | between sections; a page's top and bottom padding | `gap-section`, `py-section` |

A title over its meta line is line-height, not a gap. A value off the scale (12, 20, 32) needs a reason in a comment. The one standing exception: a tinted pill (Notice, the demo note) pads its sides 12 px to match its 12 px corner radius, so text never meets the curve.

### App shell

- **Header:** sticky, 4 px + the 44 px logo/bell row + 8 px. In the demo, one more 32 px line (the demo note: "Demo, resets in 24 h. Sign in", dismissible until the browser closes). At 320×640 that leaves at least 480 px of page between the header and the bottom nav.
- **Bottom nav:** fixed, `z-40` (above anything a page lifts; dialogs and toasts are `z-50`). Its real height is `--nav-height` (60 px on phones, 74 px from `md`; `app/globals.css`), plus the safe-area inset. Everything that clears the nav uses it: `<main>`'s bottom padding (+32 px), the status toast (+8 px), the Subtle celebration, pinned form buttons, `<html>`'s `scroll-padding-bottom` (so keyboard focus never lands under the nav or a pinned bar). Change it together with the nav.
- **Kid view:** no header, no nav, no demo note (a child holds the phone).

### Surfaces (cards)

A card is for an object you can **pick, compare or open**: a habit, a group, a recap, a template, a kid habit tile. `components/ui/surface.tsx` is the one card style (16 px radius, `p-item`, soft shadow) and it is always tappable: `as="a"` (a link, `href` required) for something that opens, `as="button"` (an `onClick`, or `type="submit"`) for something you pick. There is no static card; in a list the row is `<li><Surface as="a">`. The types refuse a Surface without `as` (`components/ui/primitives.typecheck.tsx`).

Not a card: a sentence (use a Notice), a single stat (a line of text), a heading with controls under it (use a Section), a form, a settings group, an empty state. No card inside a card.

### Sections

`components/ui/section.tsx`: a heading (16 px bold), an optional action at its end, then the content, 16 px apart. Sections sit 24 px apart. The heading names the region for screen readers.

### Notices

`components/ui/notice.tsx`: an inline status line in a soft tint, no shadow. Tones: info (muted), success (sage), error (red). One or two lines: what happened, then the next step as its `action` (a link or button). Optional dismiss. `live` when it appears after something the person did, so screen readers announce it (errors as alert).

### Empty states

`components/ui/empty-state.tsx`: a small line icon in a pastel circle, one sentence that says what fills this place, and the **action that fills it** (required). No card. No mascots.

### Buttons

`components/ui/button.tsx` defaults to 44 px tall (`h-11`); `sm` is 40 px (only beside other controls in a row), `lg` 48 px, `icon` 44 px square. No smaller sizes. Every tap target is at least 44×44, including links inside lines (negative margins keep the line short).

### States and feedback

Every action has four states and a next step:

| State | What the person sees |
|---|---|
| Idle | The button with its verb ("Add habit") |
| In progress | The label changes ("Adding…") and the button is disabled. An icon-only button (the check-in) changes its accessible name ("Checking in: Read…") and its icon spins |
| Success | A visible confirmation where the result isn't already on screen: a status toast, with the next step as its action ("Undo", "Open") |
| Error | What happened and what to do, next to the control (a `live` error Notice), and the input kept |

**Opening a page.** A tap answers at once. Every app route has a `loading.tsx` (prefetched with its link) that draws the page's shape in soft `bg-muted` blocks inside the shell, from `components/app-shell/page-skeleton.tsx`: same spacing and line boxes as the page, cards only where the page has cards, `motion-safe:animate-pulse`, `aria-busy` and one polite "Loading…" (no `role=status`: pages own theirs). A route that wasn't prefetched yet shows its tapped tab in the active colour with a small bar, and a tapped card a soft tint, until it commits (`useLinkStatus`). An index page whose section has child routes keeps its loading screen in a route group (`progress/(overview)/`), so a child route never shows the parent's skeleton first.

**Forms.** The app's own messages, never the browser's bubbles: every form is `noValidate`, and `required` stays on the fields so assistive tech still hears it. The server checks every field and names the one it refused; the message (what's wrong and what to do, from the catalog; beside the field a plain "Enter a nickname." says both) sits right under that field, which gets `aria-invalid="true"` and `aria-describedby` pointing at it (`describedBy()` in `lib/field-error.ts` joins it with a help line). A control group where `aria-invalid` isn't allowed (emoji button, chips) uses `data-invalid`. After a refused submit, focus moves to the first invalid field (`useFocusFirstInvalid`, `lib/focus-first-invalid.ts`), which reads its message, so the field message has no `role=alert`. A message about no single field (offline, a server error) is a `live` error Notice above the submit. The submit says what it's doing ("Adding…") and is disabled meanwhile. A destructive confirm (type RESET) keeps its button disabled until the word matches.

**Settings save on change.** Each setting says "Saving…", then "Saved ✓" beside it (a `role=status` line, `components/profile/setting-status.tsx`), or why it wasn't saved and what to do. A choice that couldn't be saved goes back to the saved one, with that message beside it: never silently. A typed field (the display name) has its own Save right beside it, never one Save at the bottom for several fields. A download (Export) says which file it saved.

**Status toast** (`components/ui/toast.tsx`, logic in `lib/toast.ts`): one at a time above the bottom nav; its words (not its buttons) are in a polite live region; 5 s, 8 s with an action, paused while hovered or focused; an X to close.
- On the same page, from a client component after the action resolves: `useToast().showToast({ text, action })`, with translated text. The action is a link (`{ label, href }`) or a callback (`{ label, onAction }`, for Undo).
- After a server action that redirects: `await flashToast({ text, values, action })` (`lib/toast-server.ts`) and then `redirect()`. It sets a 60 s cookie (`secure` in production, with the time it was set; older ones are dropped) with catalog keys (client namespaces only) and values; the app layout hands it to the Toaster on the next page, which translates it, shows it once and clears it. The action can only be a link there (an in-app path). A flash is fleeting: the next toast on that page (a check-in's "· Undo") replaces it instead of waiting behind it.
- Behind an open dialog a toast can't be seen (the overlay covers it): close the dialog first, then show the toast.
- A toast confirms something the screen does not already show. When the change is visible in place, no toast, with one exception: a toast carrying Undo is allowed for an in-place change when the screen has no in-place Undo and a persistent Undo exists elsewhere (e.g. the habit page). So a check-in on Today turns green *and* gets "Read 20 min checked in · Undo" (`lib/check-in-undo.ts`); Undo shows "Undoing Read 20 min…" (sticky until it answers), then "check-in undone", or what went wrong with Undo again. One such toast at a time.

## Motion

- **Durations:** 150–250 ms, ease-out.
- **Check-in:** the round button fills sage green with a small bounce; a soft haptic tick where the phone supports it (Android); no sound. From M5, "+N XP" floats up and fades: 10, and on the first check-in of the period plus 1 per day of the streak before it, up to +30 ("+XP" for a tap still waiting on the phone).
- **Finishing check-in** (target reached): a warm glow and "Done for today" / "Done for this week" / "Done for this month".
- **Milestones:** a card at the top of Today (flame animation from 7), never a full-screen interruption.
- **Full-screen moments:** only level-ups and new badges, about 2 seconds of soft confetti in category colors, once each. Settings → Celebrations: Full / Subtle (Subtle shows cards instead).
- **Reduced motion:** with `prefers-reduced-motion`, keep the state change and drop bounce, float, glow and confetti.

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

- **Every size comes from the master.** `app/favicon.ico` (16, 32, 48), `app/apple-icon.png` (180), and `public/icons/` are rendered from it by a script, never drawn by hand (`scripts/gen-app-icons.mjs` for the PNGs below).
- **Installed-app icons ("any": Chrome/Edge desktop, macOS Dock, Windows):** `icon-192/512/1024.png` put the peach tile on the macOS icon grid: a transparent canvas, the tile 824 of 1024 px with a 100 px margin, corner radius 185 px, a soft shadow, and no drawn edge. An edge-to-edge tile with its own border looked like a box in a box next to native icons.
- **In-app pictures** (landing, sign-in, invite, notifications) use `logo-192.png`, the full-bleed tile; CSS rounds the corners.
- **The iOS icon is full-bleed; the OS rounds it.** `apple-icon.png` has no rounded corners and no edge.
- **Maskable:** full-bleed peach, with the sprout at about 70% so it stays inside the safe zone.
- **Launch screens:** Android draws its own from the manifest (`background_color` cream, the "any" icon). The installed iPhone app gets `public/splash/iphone-*.png`, cream with the tile at 30% of the width, one per screen size in `lib/ios-splash.json` (`scripts/gen-ios-splash.mjs`; a new iPhone size is a new row there).

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
- Toasts for things the screen already shows (a toast is for a result that happened elsewhere; the one exception is Undo for an in-place change with no in-place Undo, see "States and feedback").
- Cards around sentences, single numbers or headed groups of controls.
