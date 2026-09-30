import Link from "next/link";
import { Bell } from "lucide-react";
import { dayLabel, relativeTime, todayIn } from "@/lib/dates";
import { feedCopy, type FeedItem } from "@/lib/feed-copy";
import { cn } from "@/lib/utils";

// Activity, newest first, under day headings in the viewer's time zone.
export function FeedList({ items, timeZone, now }: { items: FeedItem[]; timeZone: string; now: Date }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <Bell aria-hidden className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground">Nothing yet. Activity from your groups shows up here.</p>
      </div>
    );
  }

  const today = todayIn(timeZone, now);
  const days = new Map<string, FeedItem[]>();
  for (const n of items) {
    const day = todayIn(timeZone, new Date(n.created_at));
    days.set(day, [...(days.get(day) ?? []), n]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...days].map(([day, rows]) => (
        <section key={day} aria-label={dayLabel(day, today)} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{dayLabel(day, today)}</h2>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
            {rows.map((n) => {
              const { title, body, href } = feedCopy(n);
              const inner = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-semibold text-muted-foreground">{title}</span>
                    <span className="text-sm">{body}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{relativeTime(n.created_at, timeZone, now)}</span>
                </>
              );
              const className = cn("flex min-h-14 items-start gap-3 px-4 py-3", !n.read_at && "bg-accent/50");
              return (
                <li key={n.id} className="border-t border-border first:border-t-0">
                  {href ? (
                    <Link href={href} className={cn(className, "hover:bg-muted")}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={className}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
