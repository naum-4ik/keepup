import { Flame } from "lucide-react";

export function StreakBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-flame">
      <Flame className="size-4 fill-current" aria-hidden />
      <span className="sr-only">Streak:</span>
      {count}
    </span>
  );
}
