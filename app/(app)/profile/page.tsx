import Link from "next/link";
import { Award, ChevronRight, Settings, Sparkles, Users, type LucideIcon } from "lucide-react";
import { AvatarEdit } from "@/components/avatar-edit";
import { LevelCard } from "@/components/profile/level-card";
import { SignOutButton } from "@/components/sign-out-button";
import { getProfile } from "@/lib/auth";
import { isAvatarColor } from "@/lib/avatars";
import { cityOf } from "@/lib/timezones";
import { appVersion } from "@/lib/version";
import { getMyLevel } from "@/lib/xp-data";
import { saveAvatar } from "./actions";

// Where to go from Profile, as one list. Self-contained, so cards can sit above it later.
const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/profile/achievements", label: "Achievements", icon: Award },
  { href: "/profile/settings", label: "Settings", icon: Settings },
  { href: "/whats-new", label: "What's new", icon: Sparkles },
  { href: "/groups", label: "Groups", icon: Users },
];

export default async function ProfilePage() {
  const [{ profile }, level] = await Promise.all([getProfile(), getMyLevel()]);

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AvatarEdit
          name={profile.display_name}
          emoji={profile.avatar_emoji}
          color={profile.avatar_color && isAvatarColor(profile.avatar_color) ? profile.avatar_color : null}
          action={saveAvatar}
          title="Change your avatar"
          description="Shown to your groups."
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {cityOf(profile.timezone)} · weeks start {profile.week_start === 0 ? "Sunday" : "Monday"}
          </p>
        </div>
      </div>
      {level && <LevelCard xp={level.xp} />}
      <nav aria-label="Account">
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href} className="border-t border-border first:border-t-0">
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-muted">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 font-semibold">{label}</span>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
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
          Privacy Policy
        </Link>
      </footer>
    </section>
  );
}
