import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/avatar";

export function AppHeader({
  displayName,
  avatarEmoji,
  avatarColor,
  unread = 0,
}: {
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  unread?: number;
}) {
  return (
    <header
      className="sticky top-0 z-10 bg-background/95 pb-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      {/* Same column as the page, so on a wide screen the logo and avatar sit above the content. */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <Link href="/today" className="text-xl font-extrabold tracking-tight">
          <span className="text-foreground">Keep</span>
          <span className="text-primary">up</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/inbox"
            aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
            className="relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <Bell aria-hidden className="size-5.5" />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-bold text-primary-foreground tabular-nums ring-2 ring-background"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="rounded-full hover:brightness-95"
          >
            <Avatar
              name={displayName}
              emoji={avatarEmoji}
              color={avatarColor}
              size="md"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
