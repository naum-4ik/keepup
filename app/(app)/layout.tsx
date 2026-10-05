import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineQueueProvider } from "@/components/offline/offline-queue-provider";
import { PushRefresh } from "@/components/notifications/push-refresh";
import { getProfile } from "@/lib/auth";
import { getUnreadCount } from "@/lib/inbox";
import { levelFraction } from "@/lib/levels";
import { getMyLevel } from "@/lib/xp-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, unread, level] = await Promise.all([getProfile(), getUnreadCount(), getMyLevel()]);
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    <OfflineQueueProvider userId={profile.id}>
      <div className="flex min-h-dvh flex-col">
        <AppHeader unread={unread}>
          <OfflineBanner placement="header" />
        </AppHeader>
        {/* wrap-anywhere (inherited): a long name with no spaces wraps instead of widening the page. */}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 wrap-anywhere">{children}</main>
        <BottomNav
          displayName={profile.display_name}
          avatarEmoji={profile.avatar_emoji}
          avatarColor={profile.avatar_color}
          level={level?.level ?? null}
          xpProgress={level ? levelFraction(level.xp) : null}
        />
        <PushRefresh />
        {/* New Inbox rows (approvals asked, check-ins, nudges) refresh whatever page is open, so the
            bell's count is never stale off the Inbox; RLS applies. */}
        <LiveRefresh table="notifications" filter={`user_id=eq.${profile.id}`} />
      </div>
    </OfflineQueueProvider>
  );
}
