import Link from "next/link";
import type { ReactNode } from "react";
import { Award, ChevronRight, Settings, Sparkles, Users, type LucideIcon } from "lucide-react";
import { AvatarEdit } from "@/components/avatar-edit";
import { LevelCard } from "@/components/profile/level-card";
import { SignOutButton } from "@/components/sign-out-button";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { isAvatarColor } from "@/lib/avatars";
import { cityOf } from "@/lib/timezones";
import { appVersion } from "@/lib/version";
import { getMyLevel } from "@/lib/xp-data";
import { saveAvatar } from "./actions";

// Where to go from Profile, as one list. Self-contained, so cards can sit above it later.
const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/profile/achievements", label: "achievements.title", icon: Award },
  { href: "/profile/settings", label: "settings.title", icon: Settings },
  { href: "/whats-new", label: "profile.links.whatsNew", icon: Sparkles },
  { href: "/groups", label: "nav.groups", icon: Users },
];

// profile.summary reads as one line here; the city is its own element, as on onboarding.
const summaryTags = {
  place: (c: ReactNode) => <span>{c}</span>,
  dot: (c: ReactNode) => c,
  week: (c: ReactNode) => c,
};

export default async function ProfilePage() {
  const [{ profile }, level, { t, rich }] = await Promise.all([getProfile(), getMyLevel(), getT()]);

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AvatarEdit
          name={profile.display_name}
          emoji={profile.avatar_emoji}
          color={profile.avatar_color && isAvatarColor(profile.avatar_color) ? profile.avatar_color : null}
          action={saveAvatar}
          title={t("profile.avatar.title")}
          description={t("profile.avatar.description")}
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {rich("profile.summary", {
              city: cityOf(profile.timezone),
              weekStart: profile.week_start === 0 ? "sun" : "mon",
              ...summaryTags,
            })}
          </p>
        </div>
      </div>
      {level && <LevelCard xp={level.xp} />}
      <nav aria-label={t("profile.accountNav")}>
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href} className="border-t border-border first:border-t-0">
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-muted">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 font-semibold">{t(label)}</span>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SignOutButton />
      <footer className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/whats-new" className="font-mono underline-offset-4 hover:underline">
          {appVersion()}
        </Link>
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          {t("profile.footer.privacy")}
        </Link>
        <Link href="/install" className="underline-offset-4 hover:underline">
          {t("profile.footer.install")}
        </Link>
      </footer>
    </section>
  );
}
