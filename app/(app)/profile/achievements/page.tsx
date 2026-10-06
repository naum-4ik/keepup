import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { getProfile } from "@/lib/auth";
import { getBadges } from "@/lib/badges-data";

// The badge collection, opened from Profile's list (owner, 2026-10-05).
export default async function AchievementsPage() {
  const [{ profile }, badges] = await Promise.all([getProfile(), getBadges()]);

  return (
    <section className="flex flex-col gap-3 pt-2 pb-6">
      <Link href="/profile" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Profile
      </Link>
      <h1 className="text-xl font-bold">Achievements</h1>
      {badges.length > 0 ? (
        <BadgeGrid groups={badges} timeZone={profile.timezone} />
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Badges can&apos;t be shown right now. Try again later.</p>
      )}
    </section>
  );
}
