import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { DemoNote } from "@/components/demo/demo-note";
import { FaroUser } from "@/components/observability/faro";
import { CelebrationMoment } from "@/components/celebrations/celebration-moment";
import { LiveRefresh } from "@/components/habits/live-refresh";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineQueueProvider } from "@/components/offline/offline-queue-provider";
import { PushRefresh } from "@/components/notifications/push-refresh";
import { LocaleSync } from "@/components/profile/locale-sync";
import { LOCALE_COOKIE, enabledLocales, pickLocale, type Locale } from "@/i18n/config";
import { getProfile } from "@/lib/auth";
import { DEMO_NOTE_COOKIE } from "@/lib/demo-note";
import { getUnreadCount } from "@/lib/inbox";
import { levelFraction } from "@/lib/levels";
import { localeSync } from "@/lib/locale-sync";
import { getMyLevel } from "@/lib/xp-data";
import { LOCALES } from "@/supabase/functions/_shared/i18n";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ profile, who }, unread, level] = await Promise.all([getProfile(), getUnreadCount(), getMyLevel()]);
  if (!profile.onboarded_at) redirect("/onboarding");
  const requestLocale = (await getLocale()) as Locale;
  const cookieStore = await cookies();
  const sync = localeSync({
    profileLocale: profile.locale ?? null,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value ?? null,
    detected: pickLocale((await headers()).get("accept-language"), [...LOCALES]),
    requestLocale,
    enabled: enabledLocales(),
  });

  return (
    <OfflineQueueProvider userId={profile.id}>
      <div className="flex min-h-dvh flex-col">
        <AppHeader unread={unread}>
          {profile.is_demo && cookieStore.get(DEMO_NOTE_COOKIE)?.value !== "hidden" && <DemoNote />}
          <OfflineBanner placement="header" />
        </AppHeader>
        {/* wrap-anywhere (inherited): a long name with no spaces wraps instead of widening the page. The bottom
            padding clears the fixed nav, its safe-area inset (the iPhone home bar) and 2rem more. */}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+2rem)] wrap-anywhere">{children}</main>
        <BottomNav
          displayName={profile.display_name}
          avatarEmoji={profile.avatar_emoji}
          avatarColor={profile.avatar_color}
          level={level?.level ?? null}
          xpProgress={level ? levelFraction(level.xp) : null}
        />
        {/* A demo login has no push devices (the database refuses them): no re-save on app open. */}
        {!profile.is_demo && <PushRefresh />}
        {/* Level-ups and new badges, once each, when a page opens (Settings → Celebrations). */}
        <CelebrationMoment />
        {(sync.saveToProfile || sync.setCookie) && (
          <LocaleSync save={sync.saveToProfile} cookie={sync.setCookie} refresh={!!sync.setCookie && sync.setCookie !== requestLocale} />
        )}
        <FaroUser id={profile.id} email={typeof who["user.email"] === "string" ? who["user.email"] : undefined} demo={profile.is_demo} />
        {/* New Inbox rows (approvals asked, check-ins, nudges) refresh whatever page is open, so the
            bell's count is never stale off the Inbox; RLS applies. */}
        <LiveRefresh table="notifications" filter={`user_id=eq.${profile.id}`} />
      </div>
    </OfflineQueueProvider>
  );
}
