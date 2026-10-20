import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Loading screens (the routes' loading.tsx): the page's shape in soft `bg-muted` blocks while its data
// loads, inside the app shell (header and bottom nav stay). A route's loading.tsx is prefetched with
// the link, so a tap shows it at once instead of leaving the old page up. Built from the same
// spacing as the pages (docs/design.md: inner 8, item 16, section 24) and the same line boxes, so the
// real page lands where the skeleton was. Cards only where the real page has cards (habit, group rows).
// Every block is aria-hidden; the region says it's busy and one polite line says "Loading…". It is no
// role="status" on purpose: pages own their status lines (Today's summary, "Saved ✓"), and a second
// status inside <main> would make `main.getByRole("status")` ambiguous while the page swaps in.

const pulse = "bg-muted motion-safe:animate-pulse";

// One block. `className` sets its size and shape (rounded-full by default: a line of text, a circle).
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block shrink-0 rounded-full", pulse, className)} />;
}

// A line of text: the block sits in the line box of the text it stands for, so heights match.
export function TextBone({ size = "base", className }: { size?: "xs" | "sm" | "base" | "xl"; className?: string }) {
  const box = { xs: "h-4", sm: "h-5", base: "h-6", xl: "h-7" }[size];
  const bar = { xs: "h-2.5", sm: "h-3", base: "h-3.5", xl: "h-5" }[size];
  return (
    <span aria-hidden className={cn("flex items-center", box)}>
      <Bone className={cn(bar, "w-32", className)} />
    </span>
  );
}

// The page frame, as the pages use it: sections 24 px apart, 24 px top and bottom.
export function PageSkeleton({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("common");
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {t("loading")}
      </p>
      <div aria-busy="true" data-testid="page-skeleton" className={cn("flex flex-col gap-section py-section", className)}>
        {children}
      </div>
    </>
  );
}

// "Today", "Progress": the h1 (text-xl) with something at its end (a date, a link).
export function TitleRow({ end }: { end?: string }) {
  return (
    <div className="flex items-center justify-between gap-inner">
      <TextBone size="xl" className="w-28" />
      {end && (
        <span aria-hidden className="flex h-11 items-center">
          <Bone className={cn("h-3", end)} />
        </span>
      )}
    </div>
  );
}

// The back link over a page title (‹ Profile / Settings).
export function BackTitle({ title = "w-40" }: { title?: string }) {
  return (
    <div className="flex flex-col gap-inner">
      <span aria-hidden className="flex h-11 items-center">
        <Bone className="h-3 w-20" />
      </span>
      <TextBone size="xl" className={title} />
    </div>
  );
}

// A section heading (text-base bold) over its content.
export function SectionBones({ children, heading = "w-24" }: { children: React.ReactNode; heading?: string }) {
  return (
    <div className="flex flex-col gap-item">
      <TextBone className={heading} />
      {children}
    </div>
  );
}

// Card rows (a habit on Today and Progress, a group): the Surface's look, a chip, two lines.
export function CardRows({ count = 3, end = true, chip = "size-10" }: { count?: number; end?: boolean; chip?: string }) {
  return (
    <ul aria-hidden className="flex flex-col gap-item">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-inner rounded-2xl bg-card p-item shadow-soft">
          <Bone className={chip} />
          <span className="flex min-w-0 flex-1 flex-col">
            <TextBone className={i % 2 ? "w-28" : "w-36"} />
            <TextBone size="sm" className="w-20" />
          </span>
          {end && <Bone className="size-11" />}
        </li>
      ))}
    </ul>
  );
}

// Plain list rows (Profile's links, a group's habits, the Inbox feed): no card, a circle and a line or two.
export function ListRows({ count = 3, chip = "size-9", lines = 2, divided = false }: { count?: number; chip?: string; lines?: 1 | 2; divided?: boolean }) {
  return (
    <ul aria-hidden className={cn("flex flex-col", divided ? "divide-y divide-border" : "gap-inner")}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-item">
          <Bone className={chip} />
          <span className="flex min-w-0 flex-1 flex-col">
            <TextBone className={i % 2 ? "w-24" : "w-36"} />
            {lines === 2 && <TextBone size="xs" className="w-28" />}
          </span>
        </li>
      ))}
    </ul>
  );
}

// A segmented control (Progress's and the Inbox's tabs): the muted track, the selected pill.
export function TabsBones({ tabs }: { tabs: 2 | 3 }) {
  return (
    <div aria-hidden className={cn("grid gap-1 rounded-xl bg-muted p-1", tabs === 3 ? "grid-cols-3" : "grid-cols-2")}>
      <span className="h-11 rounded-lg bg-card shadow-soft" />
    </div>
  );
}

// Form fields: a label over an input.
export function FieldBones({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-item">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-inner">
          <TextBone size="sm" className="w-24" />
          <Bone className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
