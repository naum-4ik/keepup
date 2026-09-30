import { requireUser } from "@/lib/auth";

// The kid view: full screen on a parent's phone. No header, no bottom nav; a signed-in adult only.
export default async function KidLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</main>
    </div>
  );
}
