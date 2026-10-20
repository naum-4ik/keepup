import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Your avatar lives on the bottom nav's Profile tab (the header had the same link twice).
// Kept short (design pass PR 1): 4px + the 44px bell row + 8px, and the demo note is one 32px line,
// so a phone at 320×640 keeps at least 480px for the page between the header and the bottom nav.
export async function AppHeader({
  unread,
  children,
}: {
  // The Inbox's unread count. A promise, so the header (and the page under it) doesn't wait for it: the bell
  // shows at once and its count joins when the count arrives (a fixed-size badge: nothing moves).
  unread: Promise<number>;
  // Under the logo row, sticky with it (the offline banner).
  children?: React.ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-30 bg-background/95 pb-2 backdrop-blur"
      style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top))" }}
    >
      {/* Same column as the page, so on a wide screen the logo and bell sit above the content. */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <Link href="/today" className="flex min-h-11 items-center text-xl font-extrabold tracking-tight">
          <span className="text-foreground">Keep</span>
          <span className="text-primary">up</span>
        </Link>
        <Suspense fallback={<InboxBell unread={0} />}>
          <InboxBell unread={unread} />
        </Suspense>
      </div>
      {children}
    </header>
  );
}

async function InboxBell({ unread: count }: { unread: number | Promise<number> }) {
  const [t, unread] = await Promise.all([getTranslations("nav"), count]);
  return (
    <Link
      href="/inbox"
      aria-label={unread > 0 ? t("inboxUnread", { n: unread }) : t("inbox")}
      className="relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
    >
      <Bell aria-hidden className="size-5.5" />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1 end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-bold text-primary-foreground tabular-nums ring-2 ring-background"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
