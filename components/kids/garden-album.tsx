import { GardenPicture } from "@/components/kids/garden";
import { Section } from "@/components/ui/section";
import { INTL_LOCALE, type Locale, type T } from "@/supabase/functions/_shared/i18n";

// Past weeks' gardens, newest first, in a horizontal scroll-snap strip.
// Past weeks are drawn in the child's current theme.
export function GardenAlbum({ t, locale, weeks, theme }: { t: T; locale: Locale; weeks: { week_start: string; stars: number }[]; theme?: string | null }) {
  if (weeks.length === 0) return null;
  const week = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    // scroll-mt-20: "See the album" lands below the sticky header.
    <Section id="album" title={t("kids.garden.album")} className="scroll-mt-20">
      {/* -mx-item px-item: the strip scrolls to the screen's edges; pb-inner leaves room for its scrollbar. */}
      <ul className="-mx-item flex snap-x snap-mandatory gap-item overflow-x-auto px-item pb-inner">
        {weeks.map((w) => (
          <li key={w.week_start} className="flex shrink-0 snap-start flex-col gap-inner">
            <GardenPicture t={t} stars={w.stars} size="sm" theme={theme} />
            <span className="text-xs text-muted-foreground">
              {t("kids.garden.weekOf", { date: week.format(new Date(`${w.week_start}T00:00:00Z`)), stars: w.stars })}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
