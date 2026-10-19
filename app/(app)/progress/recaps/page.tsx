import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { MonthHeatmap } from "@/components/recaps/month-heatmap";
import { getProfile } from "@/lib/auth";
import { badgeName } from "@/lib/badges";
import { getT } from "@/lib/i18n/server";
import { getRecaps } from "@/lib/recaps-data";
import { recapLine, recapTitle, streakLabel } from "@/lib/recaps";

// Past recaps (ideas/achievements-and-rewards.md §6): the last 8 weeks and 6 months, wins first.
export default async function RecapsPage() {
  const [{ profile }, weeks, months, { t, locale }] = await Promise.all([getProfile(), getRecaps("week", 8), getRecaps("month", 6), getT()]);
  const weekStart = (profile.week_start === 0 ? 0 : 1) as 0 | 1;

  return (
    <section className="flex flex-col gap-section py-section">
      <div className="flex items-center justify-between gap-inner">
        <h1 className="text-xl font-bold">{t("recaps.page.title")}</h1>
        {/* -me-inner: the link's padding, so its words line up with the page edge (a 44 px target). */}
        <Link href="/progress" className="-me-inner flex h-11 items-center rounded-full px-inner text-sm font-semibold text-primary hover:bg-muted">
          {t("progress.back")}
        </Link>
      </div>

      {/* A recap is a line to read, not something to open or pick: list rows with dividers, no cards
          (docs/design.md "Surfaces"). */}
      <Section title={t("recaps.page.weeks")}>
        {weeks.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            action={
              // Recaps come from check-ins: the way to the first one.
              <Button asChild variant="outline">
                <Link href="/today">{t("recaps.page.goToday")}</Link>
              </Button>
            }
          >
            {t("recaps.page.firstWeekly")}
          </EmptyState>
        ) : (
          // py-inner on each row + the divider: 16 px from one row's text to the next (the item level).
          <ul className="-mt-inner flex flex-col divide-y divide-border">
            {weeks.map((r) => (
              <li key={r.start} className="flex flex-col py-inner">
                <p className="text-xs font-semibold text-muted-foreground">{recapTitle(t, locale, r)}</p>
                <p className="font-semibold">{recapLine(t, locale, r, "history")}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {months.length > 0 && (
        <Section title={t("recaps.page.months")}>
          <div className="flex flex-col gap-section">
            {months.map((r) => {
              const rested = r.days.reduce((n, d) => n + d.rested, 0);
              const id = `month-${r.start}`;
              return (
                <section key={r.start} aria-labelledby={id} className="flex flex-col gap-inner">
                  <div>
                    <h3 id={id} className="text-xs font-semibold text-muted-foreground">{recapTitle(t, locale, r)}</h3>
                    <p className="font-semibold">{recapLine(t, locale, r, "history")}</p>
                  </div>
                  <MonthHeatmap recap={r} weekStart={weekStart} t={t} locale={locale} />
                  {rested > 0 && <p className="text-sm text-muted-foreground">{t("recaps.page.restDays", { n: rested })}</p>}
                  {r.top.length > 0 && (
                    <ul aria-label={t("recaps.page.topStreaks")} className="flex flex-col text-sm">
                      {r.top.map((s) => <li key={s.title}>{s.emoji} {streakLabel(t, s)}</li>)}
                    </ul>
                  )}
                  {r.badges.length > 0 && (
                    <p className="text-sm text-muted-foreground">{t("recaps.page.badges", { list: r.badges.map((b) => badgeName(t, b.code, b.name)).join(t("common.listSeparator")) })}</p>
                  )}
                </section>
              );
            })}
          </div>
        </Section>
      )}
    </section>
  );
}
