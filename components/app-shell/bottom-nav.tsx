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

// `glyph` replaces the icon (the Profile tab shows your avatar).
function NavLink({ href, label, icon: Icon, active, glyph }: NavItem & { active: boolean; glyph?: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-xs font-semibold",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {glyph ?? <Icon className="size-5" aria-hidden />}
      {label}
    </Link>
  );
}

export function BottomNav({
  displayName,
  avatarEmoji,
  avatarColor,
}: {
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const onProfile = isActive(PROFILE.href);

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
            // Your avatar is the Profile tab. Decoration: the link is named "Profile". 24px with -my-0.5,
            // so the tab is exactly as tall as the 20px icons beside it (the nav's height doesn't move).
            glyph={
              <span aria-hidden className={cn("-my-0.5 flex rounded-full", onProfile && "ring-2 ring-primary ring-offset-1 ring-offset-card")}>
                <Avatar name={displayName} emoji={avatarEmoji} color={avatarColor} size="sm" className="size-6 text-xs" />
              </span>
            }
          />
        </li>
      </ul>
    </nav>
  );
}
