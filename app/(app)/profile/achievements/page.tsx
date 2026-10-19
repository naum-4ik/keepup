import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { Notice } from "@/components/ui/notice";
import { RefreshButton } from "@/components/ui/refresh-button";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getBadges } from "@/lib/badges-data";

// The badge collection, opened from Profile's list (owner, 2026-10-05).
export default async function AchievementsPage() {
  const [{ profile }, badges, { t }] = await Promise.all([getProfile(), getBadges(), getT()]);

  return (
    <div className="flex flex-col gap-section py-section">
      <div className="flex flex-col gap-inner">
        {/* -ms-inner: the chevron lines up with the page edge; 4 px icon to label (one glyph pair). */}
        <Link href="/profile" className="-ms-inner flex h-11 w-fit items-center gap-1 rounded-full px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("nav.profile")}
        </Link>
        <h1 className="text-xl font-bold">{t("achievements.title")}</h1>
      </div>
      {badges.length > 0 ? (
        <BadgeGrid groups={badges} timeZone={profile.timezone} />
      ) : (
        // getBadges answers [] only when the read failed: the badges are still there.
        <Notice
          tone="error"
          action={
            <RefreshButton
              label={t("common.tryAgain")}
              pendingLabel={t("common.loading")}
              // A 44px target kept to the Notice's line height by negative margins (docs/design.md "Buttons").
              className="-my-3 flex min-h-11 items-center rounded-lg px-inner font-bold text-primary hover:bg-background/60 disabled:opacity-60"
            />
          }
        >
          {t("achievements.unavailable")}
        </Notice>
      )}
    </div>
  );
}
