"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartColumn, CircleUser, Plus, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const TODAY: NavItem = { href: "/today", label: "Today", icon: CalendarCheck };
const PROGRESS: NavItem = { href: "/progress", label: "Progress", icon: ChartColumn };
const PRIMARY: NavItem = { href: "/habits/new", label: "New habit", icon: Plus };
const GROUPS: NavItem = { href: "/groups", label: "Groups", icon: Users };
const PROFILE: NavItem = { href: "/profile", label: "Profile", icon: CircleUser };

// `glyph` replaces the icon (the Profile tab shows your avatar); `name`: the link's name when the glyph
// adds something to say ("Profile, level 2, 40% to level 3").
function NavLink({ href, label, icon: Icon, active, glyph, name }: NavItem & { active: boolean; glyph?: React.ReactNode; name?: string }) {
  return (
    <Link
      href={href}
      aria-label={name}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-xs font-semibold",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {/* md+: a 36px box, so every label lines up under the Profile tab's larger avatar and ring. */}
      <span className="flex items-center justify-center md:h-9">{glyph ?? <Icon className="size-5" aria-hidden />}</span>
      {label}
    </Link>
  );
}

const RING_R = 12;
const RING_C = 2 * Math.PI * RING_R;

// The way to the next level: a 2px sage arc over a soft track, from 12 o'clock, clockwise. Decoration (the
// link's name says the percent). The fill eases to a new value; none under prefers-reduced-motion.
function XpRing({ fraction }: { fraction: number }) {
  return (
    <svg data-testid="xp-ring" data-progress={fraction.toFixed(2)} viewBox="0 0 26 26" className="pointer-events-none absolute -inset-[3px] size-[26px] -rotate-90 md:-inset-1 md:size-9" fill="none" strokeWidth={2}>
      <circle cx={13} cy={13} r={RING_R} vectorEffect="non-scaling-stroke" className="stroke-muted" />
      <circle
        cx={13}
        cy={13}
        r={RING_R}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - fraction)}
        className="stroke-done transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        style={fraction === 0 ? { opacity: 0 } : undefined}
      />
    </svg>
  );
}

export function BottomNav({
  displayName,
  avatarEmoji,
  avatarColor,
  level,
  xpProgress,
}: {
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  // The person's level (public.my_level), on the avatar; null when it couldn't be read.
  level?: number | null;
  // How far to the next level, 0 to 1 (the ring around the avatar); null when it couldn't be read: no ring.
  xpProgress?: number | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const onProfile = isActive(PROFILE.href);
  const percent = xpProgress == null ? null : Math.floor(Math.min(Math.max(xpProgress, 0), 1) * 100);
  const profileName = !level ? undefined : percent == null ? `${PROFILE.label}, level ${level}` : `${PROFILE.label}, level ${level}, ${percent}% to level ${level + 1}`;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[24px] bg-card shadow-[0_-1px_2px_rgb(61_44_34_/_0.06),0_-4px_12px_rgb(61_44_34_/_0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-center px-1">
        {[TODAY, PROGRESS].map((item) => (
          <li key={item.href} className="flex flex-1 justify-center">
            <NavLink {...item} active={isActive(item.href)} />
          </li>
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href={PRIMARY.href}
            aria-label={PRIMARY.label}
            aria-current={isActive(PRIMARY.href) ? "page" : undefined}
            className="my-1.5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft hover:brightness-90"
          >
            <PRIMARY.icon className="size-6" strokeWidth={2.5} aria-hidden />
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <NavLink {...GROUPS} active={isActive(GROUPS.href)} />
        </li>
        <li className="flex flex-1 justify-center">
          <NavLink
            {...PROFILE}
            active={onProfile}
            name={profileName}
            // Your avatar is the Profile tab. Decoration: the link is named "Profile, level 2, 40% to level 3". A 20px
            // avatar inside a 2px XP ring (26px, 3px past the avatar) and no margin: the tab stays as tall as the 20px icons
            // beside it and the ring stops at the label's line box, so it never covers "Profile". On wide screens (md+,
            // desktop, often a 1x display where a 10px emoji is a smudge) the avatar is 28px with a 36px ring, every tab's
            // icon box is 36px tall so the labels line up, and the level sits off the emoji, on the ring (owner, 2026-10-05).
            glyph={
              <span aria-hidden className="relative flex rounded-full">
                <Avatar name={displayName} emoji={avatarEmoji} color={avatarColor} size="sm" className="size-5 text-[0.625rem] md:size-7 md:text-base" />
                {percent != null ? <XpRing fraction={percent / 100} /> : null}
                {level ? (
                  // The number only; Profile says "Level 2 · Seedling" in words. Soft sage, smaller than the
                  // bell's count and never its colour, so it doesn't read as unread (owner). bottom-0, not
                  // below: the label is 2px below the avatar, so anything lower covers "Profile".
                  <span className="absolute -right-2 bottom-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-done-soft px-0.5 text-[0.5625rem] leading-none md:-right-4 md:-bottom-1 md:h-4 md:min-w-4 md:text-[0.625rem] font-bold text-done tabular-nums shadow-[0_0_0_2px_var(--card)] ring-1 ring-done/50">
                    {level}
                  </span>
                ) : null}
              </span>
            }
          />
        </li>
      </ul>
    </nav>
  );
}
