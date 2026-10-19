import { LeaveDemoButton } from "@/components/demo/leave-demo-button";
import { getT } from "@/lib/i18n/server";

// A demo login outside the app shell says so, with a way out to a real account (M6 PR 3): onboarding
// and the invite page. Same muted pill as the offline banner. Inside the app the header has the short
// DemoNote instead (components/demo/demo-note.tsx).
// Inside OfflineQueueProvider, Sign in also deletes this phone's check-in queue. `next`: where sign-in
// returns (the invite page). The status role is on the line only, so the form isn't re-announced.
export async function DemoBanner({ next }: { next?: string }) {
  const { t, rich } = await getT();
  return (
    <div
      className="mx-auto mb-2 flex w-full max-w-md flex-wrap items-center justify-center gap-x-1 rounded-xl bg-muted px-4 py-1 text-center text-sm font-semibold text-muted-foreground"
    >
      <span role="status">{t("demo.banner")}</span>
      <span className="inline-flex items-center gap-1">
        {rich("demo.signInLine", { signIn: (c: React.ReactNode) => <LeaveDemoButton next={next}>{c}</LeaveDemoButton> })}
      </span>
    </div>
  );
}
