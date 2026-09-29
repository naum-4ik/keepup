"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartColumn, Plus, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const TODAY: NavItem = { href: "/today", label: "Today", icon: CalendarCheck };
const PROGRESS: NavItem = { href: "/progress", label: "Progress", icon: ChartColumn };
const PRIMARY: NavItem = { href: "/habits/new", label: "New habit", icon: Plus };
// Profile is pinned to the corner (not part of the centred trio) so Today/＋/Progress keep an
// even flex-1/flex-1 split either side of the ＋. M3 adds Groups.
const PROFILE: NavItem = { href: "/profile", label: "Profile", icon: User };

function NavLink({ href, label, icon: Icon, active, className }: NavItem & { active: boolean; className?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold",
        active ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 rounded-t-[24px] bg-card shadow-[0_-1px_2px_rgb(61_44_34_/_0.06),0_-4px_12px_rgb(61_44_34_/_0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="relative mx-auto flex max-w-md items-center">
        <li className="flex flex-1 justify-center">
          <NavLink {...TODAY} active={isActive(TODAY.href)} className="w-full" />
        </li>
        <li className="flex shrink-0 justify-center">
          <Link
            href={PRIMARY.href}
            aria-label={PRIMARY.label}
            aria-current={isActive(PRIMARY.href) ? "page" : undefined}
            className="my-1.5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
          >
            <PRIMARY.icon className="size-6" strokeWidth={2.5} aria-hidden />
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <NavLink {...PROGRESS} active={isActive(PROGRESS.href)} className="px-4" />
        </li>
        <li className="absolute top-1/2 right-1 -translate-y-1/2">
          <NavLink {...PROFILE} active={isActive(PROFILE.href)} className="min-w-11 px-1" />
        </li>
      </ul>
    </nav>
  );
}
