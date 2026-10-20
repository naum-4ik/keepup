"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, ChartColumn, CircleUser, Plus, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { isNavActive, tabTone } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: "today" | "progress" | "newHabit" | "groups" | "profile"; icon: LucideIcon };

const TODAY: NavItem = { href: "/today", label: "today", icon: CalendarCheck };
const PROGRESS: NavItem = { href: "/progress", label: "progress", icon: ChartColumn };
const PRIMARY: NavItem = { href: "/habits/new", label: "newHabit", icon: Plus };
const GROUPS: NavItem = { href: "/groups", label: "groups", icon: Users };
const PROFILE: NavItem = { href: "/profile", label: "profile", icon: CircleUser };

// `glyph` replaces the icon (the Profile tab shows your avatar); `name`: the link's name when the glyph
// adds something to say ("Profile, level 2, 40% to level 3").
function NavLink({ href, label, icon: Icon, active, glyph, name }: Omit<NavItem, "label"> & { label: string; active: boolean; glyph?: React.ReactNode; name?: string }) {
  return (
    <Link
      href={href}
      aria-label={name}
      aria-current={active ? "page" : undefined}
      className={cn("group relative flex min-h-11 w-full rounded-xl text-xs font-semibold", !active && "hover:bg-muted")}
    >
      <TabBody active={active} label={label} glyph={glyph ?? <Icon className="size-5" aria-hidden />} />
    </Link>
  );
}

// Inside the Link (useLinkStatus reads the Link it sits in): a tapped tab turns active at once and shows a
// small bar until its page commits, so the tap answers even when the next page isn't prefetched yet (a cold
// start, a slow network). With a prefetched loading screen the page commits at once and aria-current moves.
// The bar is always there and only fades in: nothing shifts. data-pending is for tests.
function TabBody({ active, label, glyph }: { active: boolean; label: string; glyph: React.ReactNode }) {
  const { pending } = useLinkStatus();
  const tone = tabTone(active, pending);
  return (
    <span
      data-pending={tone === "pending" ? "" : undefined}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-0.5 py-2.5",
        tone === "idle" ? "text-muted-foreground group-hover:text-foreground" : "text-primary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-1 mx-auto h-0.5 w-5 rounded-full bg-primary opacity-0 transition-opacity duration-150",
          tone === "pending" && "opacity-100 motion-safe:animate-pulse",
        )}
      />
      {/* md+: a 36px box, so every label lines up under the Profile tab's larger avatar and ring. */}
      <span className="flex items-center justify-center md:h-9">{glyph}</span>
      {label}
    </span>
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

// The person's level (public.my_level) and how far to the next one, 0 to 1; null when it couldn't be read.
export type NavLevel = { level: number; xpProgress: number } | null;

type ProfileTabProps = { displayName: string; avatarEmoji?: string | null; avatarColor?: string | null; active: boolean };

export function BottomNav({
  displayName,
  avatarEmoji,
  avatarColor,
  level,
}: {
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  // A promise, so the app shell doesn't wait for it: the Profile tab shows the avatar at once and its level
  // and ring join when they arrive (both drawn over the avatar: nothing moves).
  level: Promise<NavLevel>;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isActive = (href: string) => isNavActive(pathname, href);
  const profile: ProfileTabProps = { displayName, avatarEmoji, avatarColor, active: isActive(PROFILE.href) };

  return (
    <nav
      aria-label={t("main")}
      // z-40: above anything a page lifts (z-10/z-30 sticky parts); toasts and dialogs sit at z-50.
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-[24px] bg-card shadow-[0_-1px_2px_rgb(61_44_34_/_0.06),0_-4px_12px_rgb(61_44_34_/_0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-center px-1">
        {[TODAY, PROGRESS].map((item) => (
          <li key={item.href} className="flex flex-1 justify-center">
            <NavLink {...item} label={t(item.label)} active={isActive(item.href)} />
          </li>
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href={PRIMARY.href}
            aria-label={t(PRIMARY.label)}
            aria-current={isActive(PRIMARY.href) ? "page" : undefined}
            className="my-1.5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft hover:brightness-90"
          >
            <PRIMARY.icon className="size-6" strokeWidth={2.5} aria-hidden />
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <NavLink {...GROUPS} label={t(GROUPS.label)} active={isActive(GROUPS.href)} />
        </li>
        <li className="flex flex-1 justify-center">
          <Suspense fallback={<ProfileTab {...profile} level={null} />}>
            <ProfileTabWithLevel {...profile} level={level} />
          </Suspense>
        </li>
      </ul>
    </nav>
  );
}

function ProfileTabWithLevel({ level, ...rest }: ProfileTabProps & { level: Promise<NavLevel> }) {
  return <ProfileTab {...rest} level={use(level)} />;
}

function ProfileTab({ displayName, avatarEmoji, avatarColor, active, level: read }: ProfileTabProps & { level: NavLevel }) {
  const t = useTranslations("nav");
  const level = read?.level ?? null;
  const percent = read == null ? null : Math.floor(Math.min(Math.max(read.xpProgress, 0), 1) * 100);
  const profileName = !level ? undefined : percent == null ? t("profileLevel", { level }) : t("profileLevelProgress", { level, percent: percent / 100, next: level + 1 });
  return (
    <NavLink
      {...PROFILE}
      label={t(PROFILE.label)}
      active={active}
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
            <span className="absolute -end-2 bottom-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-done-soft px-0.5 text-[0.5625rem] leading-none md:-end-4 md:-bottom-1 md:h-4 md:min-w-4 md:text-[0.625rem] font-bold text-done tabular-nums shadow-[0_0_0_2px_var(--card)] ring-1 ring-done/50">
              {level}
            </span>
          ) : null}
        </span>
      }
    />
  );
}
