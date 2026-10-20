// lib/nav.ts
// The bottom nav's tab states (components/app-shell/bottom-nav.tsx).

// The tab for a section is current on its page and every page under it (/profile/settings is Profile).
export const isNavActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// How a tab looks: the page you're on, the one you just tapped while it loads (it takes the active colour
// at once, with a small bar, so the tap answers before the page arrives), or neither.
export type TabTone = "current" | "pending" | "idle";
export const tabTone = (active: boolean, pending: boolean): TabTone => (active ? "current" : pending ? "pending" : "idle");
