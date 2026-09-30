import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { getProfile } from "@/lib/auth";
import { getUnreadCount } from "@/lib/inbox";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, unread] = await Promise.all([getProfile(), getUnreadCount()]);
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader displayName={profile.display_name} avatarEmoji={profile.avatar_emoji} avatarColor={profile.avatar_color} unread={unread} />
      {/* wrap-anywhere (inherited): a long name with no spaces wraps instead of widening the page. */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 wrap-anywhere">{children}</main>
      <BottomNav />
    </div>
  );
}
