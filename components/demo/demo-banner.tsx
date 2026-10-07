import { LeaveDemoButton } from "@/components/demo/leave-demo-button";
import { DEMO_BANNER, DEMO_SIGN_IN_TAIL } from "@/lib/demo-copy";
import { cn } from "@/lib/utils";

// Every screen of a demo login says so, with a way out to a real account (M6 PR 3). Same muted pill
// as the offline banner. "header": inside the app header. "top": the kid view, above its picture.
// Inside OfflineQueueProvider, Sign in also deletes this phone's check-in queue. `next`: where sign-in
// returns (the invite page). The status role is on the line only, so the form isn't re-announced.
export function DemoBanner({ placement, next }: { placement: "header" | "top"; next?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-1 rounded-xl bg-muted px-4 py-1 text-center text-sm font-semibold text-muted-foreground",
        placement === "header" ? "mx-auto mt-2 w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)]" : "mx-auto mb-2 w-full max-w-md",
      )}
    >
      <span role="status">{DEMO_BANNER}</span>
      <span className="inline-flex items-center gap-1">
        <LeaveDemoButton next={next} />
        <span>{DEMO_SIGN_IN_TAIL}</span>
      </span>
    </div>
  );
}
