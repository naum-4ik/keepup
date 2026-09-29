"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Plus, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; primary?: boolean };

// Task 9 adds Progress; M3 adds Groups.
const ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/habits/new", label: "New habit", icon: Plus, primary: true },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 rounded-t-[24px] bg-card shadow-[0_-1px_2px_rgb(61_44_34_/_0.06),0_-4px_12px_rgb(61_44_34_/_0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-center">
        {ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1 justify-center">
              {primary ? (
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className="my-1.5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
                >
                  <Icon className="size-6" strokeWidth={2.5} aria-hidden />
                </Link>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-semibold",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
