import Link from "next/link";
import { Avatar } from "@/components/avatar";

export function AppHeader({
  displayName,
  avatarEmoji,
  avatarColor,
}: {
  displayName: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
}) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 pb-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <Link href="/today" className="font-bold">
        <span className="text-foreground">Keep</span>
        <span className="text-primary">up</span>
      </Link>
      <Link href="/profile" aria-label="Profile" className="rounded-full hover:brightness-95">
        <Avatar name={displayName} emoji={avatarEmoji} color={avatarColor} size="md" />
      </Link>
    </header>
  );
}
