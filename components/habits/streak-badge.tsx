import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";

export function StreakBadge({ count }: { count: number }) {
  const t = useTranslations("habits.streak");
  if (count < 1) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-flame">
      <Flame className="size-4 fill-current" aria-hidden />
      <span className="sr-only">{t("label")}</span>
      {count}
    </span>
  );
}
