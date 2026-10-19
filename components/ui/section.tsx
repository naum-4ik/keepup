import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A headed part of a page without a card (docs/design.md "Surfaces"): the heading, an optional action
// at its end (a "See all" link, an Add button), then the content. Items inside sit 16px apart; the
// page puts 24px between sections (gap-section). The heading names the region for screen readers.
// `id`: the section's own, for an in-page link to it (the kid page's "See the album").
export function Section({
  id: anchor,
  title,
  action,
  children,
  className,
  level = 2,
}: {
  id?: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  level?: 2 | 3;
}) {
  const id = useId();
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section id={anchor} aria-labelledby={id} className={cn("flex flex-col gap-item", className)}>
      <div className={cn("flex items-center justify-between gap-inner", action != null && "min-h-11")}>
        <Heading id={id} className="text-base font-bold">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}
