import { GardenPicture } from "@/components/kids/garden";
import { INTL_LOCALE, type Locale, type T } from "@/supabase/functions/_shared/i18n";

// Past weeks' gardens, newest first, in a horizontal scroll-snap strip.
// Past weeks are drawn in the child's current theme.
export function GardenAlbum({ t, locale, weeks, theme }: { t: T; locale: Locale; weeks: { week_start: string; stars: number }[]; theme?: string | null }) {
  if (weeks.length === 0) return null;
  const week = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section id="album" aria-label={t("kids.garden.album")} className="flex scroll-mt-20 flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{t("kids.garden.album")}</h2>
      <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {weeks.map((w) => (
          <li key={w.week_start} className="flex shrink-0 snap-start flex-col gap-1.5">
            <GardenPicture t={t} stars={w.stars} size="sm" theme={theme} />
            <span className="text-xs text-muted-foreground">
              {t("kids.garden.weekOf", { date: week.format(new Date(`${w.week_start}T00:00:00Z`)), stars: w.stars })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
