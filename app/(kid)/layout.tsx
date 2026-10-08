import { DemoBanner } from "@/components/demo/demo-banner";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineQueueProvider } from "@/components/offline/offline-queue-provider";
import { getProfile } from "@/lib/auth";

// The kid view: full screen on a parent's phone. No header, no bottom nav; a signed-in adult only.
// Works offline from the last saved copy (ideas/offline.md §3: taps in the car).
export default async function KidLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await getProfile();
  return (
    <OfflineQueueProvider userId={userId}>
      <div className="flex min-h-dvh flex-col bg-background pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)]">
        {profile.is_demo && <DemoBanner placement="top" />}
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</main>
      </div>
      <OfflineBanner placement="bottom" />
    </OfflineQueueProvider>
  );
}
