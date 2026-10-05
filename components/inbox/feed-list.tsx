import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { SproutIcon } from "@/components/sprout-icon";
import { dayLabel, relativeTime, todayIn } from "@/lib/dates";
import { feedCopy, type FeedItem } from "@/lib/feed-copy";
import { cn } from "@/lib/utils";

// Activity, newest first, under day headings in the viewer's time zone.
export function FeedList({ items, timeZone, now }: { items: FeedItem[]; timeZone: string; now: Date }) {
  if (items.length === 0) {
    return <EmptyState icon={<Bell className="size-6" />}>Nothing yet. Activity from your groups shows up here.</EmptyState>;
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
              // Unread: a dot and words, not just the tint (docs/design.md: colour is never the only signal).
              const inner = (
                <>
                  <span className="mt-1.5 flex w-2 shrink-0">
                    {!n.read_at && (
                      <>
                        <span aria-hidden className="size-2 rounded-full bg-primary" />
                        <span className="sr-only">Unread: </span>
                      </>
                    )}
                  </span>
                  {/* Who it's from, at a glance. Decoration: the line already names them. Rows with no
                      person behind them (a child's own tap, summaries, sync notes) get the sprout. */}
                  {n.actor_name ? (
                    <span aria-hidden className="shrink-0">
                      <Avatar name={n.actor_name} emoji={n.actor_avatar_emoji} color={n.actor_avatar_color} size="sm" />
                    </span>
                  ) : (
                    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                      <SproutIcon className="size-4" />
                    </span>
                  )}
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
