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

// profile.summary reads as one line here; the city is its own element, as on onboarding.
const summaryTags = {
  place: (c: ReactNode) => <span>{c}</span>,
  dot: (c: ReactNode) => c,
  week: (c: ReactNode) => c,
};

export default async function ProfilePage() {
  const [{ profile }, level, { t, rich }] = await Promise.all([getProfile(), getMyLevel(), getT()]);

  // Where to go from Profile, as one list. Self-contained, so cards can sit above it later.
  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/profile/achievements", label: t("achievements.title"), icon: Award },
    { href: "/profile/settings", label: t("settings.title"), icon: Settings },
    { href: "/whats-new", label: t("profile.links.whatsNew"), icon: Sparkles },
    { href: "/groups", label: t("nav.groups"), icon: Users },
  ];

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
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href} className="border-t border-border first:border-t-0">
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-muted">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 font-semibold">{label}</span>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SignOutButton />
      {/* Links on one centred row that wraps between links, and inside a link only between words, never
          inside one (ru "Как установить" broke as "установит / ь" at 420 px): wrap-normal break-normal.
          Each is a 44 px target; the version on its own smaller line below. No dot separators: on a
          wrapped row one would start the second line. */}
      <footer className="flex flex-col items-center text-muted-foreground">
        <ul className="flex flex-wrap justify-center gap-x-item text-sm">
          {[
            { href: "/privacy", label: t("profile.footer.privacy") },
            { href: "/terms", label: t("profile.footer.terms") },
            { href: "/install", label: t("profile.footer.install") },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-11 items-center px-inner text-center wrap-normal break-normal underline-offset-4 hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/whats-new" className="flex min-h-11 items-center px-inner font-mono text-xs wrap-normal break-normal underline-offset-4 hover:underline">
          {appVersion()}
        </Link>
      </footer>
    </section>
  );
}
