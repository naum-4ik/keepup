import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getBadges } from "@/lib/badges-data";

// The badge collection, opened from Profile's list (owner, 2026-10-05).
export default async function AchievementsPage() {
  const [{ profile }, badges, { t }] = await Promise.all([getProfile(), getBadges(), getT()]);

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link href="/profile" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        {t("nav.profile")}
      </Link>
      <h1 className="text-xl font-bold">{t("achievements.title")}</h1>
      {badges.length > 0 ? (
        <BadgeGrid groups={badges} timeZone={profile.timezone} />
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">{t("achievements.unavailable")}</p>
      )}
    </section>
  );
}
