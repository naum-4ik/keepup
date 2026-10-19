"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { startDemo } from "@/app/demo/actions";
import { Notice } from "@/components/ui/notice";
import { runTryIt } from "@/lib/try-demo";
import { whenIdle } from "@/lib/when-idle";
import { useT } from "@/lib/i18n/client";

// "Try a demo with sample habits" on the landing page, and on sign-in and sign-up (someone who followed a
// link or tapped a step too far can still just look around): a quiet text button, 44 px tall, never the
// page's filled button. The consent line is the page's own (it covers signing up too). The anonymous sign-in happens here, in the browser, so Supabase's per-IP
// limit counts each visitor's own IP (from the server, every visitor would share Vercel's). Then the
// server seeds the demo. The device's time zone goes along, so the demo's days match the visitor's.
// ?demo=failed: the seed action couldn't start the demo (app/demo/actions.ts redirects here). A new
// try takes it out of the address (Next keeps useSearchParams in step), so the old failure goes.
// The Supabase browser client (about 60 KB gzipped) loads only when needed: on the first tap or once
// the page is idle, never with the page itself, so it doesn't slow the landing's first paint.
export function TryDemoButton() {
  const { t } = useT();
  const zone = useRef<HTMLInputElement>(null);
  const failedBefore = useSearchParams().get("demo") === "failed";
  const [failedHere, setFailedHere] = useState(false);
  const failed = failedHere || failedBefore;
  const ready = useHydrated();
  useEffect(() => {
    if (zone.current) zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return whenIdle(() => void loadSupabase().catch(() => {}));
  }, []);

  // A form action: useFormStatus stays pending through both steps.
  async function tryIt(formData: FormData) {
    setFailedHere(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("demo")) {
      url.searchParams.delete("demo");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    let supabase: Awaited<ReturnType<typeof loadSupabase>>;
    try {
      supabase = await loadSupabase();
    } catch {
      setFailedHere(true); // the script didn't load (offline, a new deploy): the same "try again" line
      return;
    }
    const result = await runTryIt({
      hasSession: async () => Boolean((await supabase.auth.getSession()).data.session),
      signIn: () => supabase.auth.signInAnonymously(),
      start: () => startDemo(formData),
      signOut: async () => void (await supabase.auth.signOut({ scope: "local" })),
      rethrow: unstable_rethrow,
    });
    if (result === "failed") setFailedHere(true);
  }

  return (
    <form action={tryIt} className="flex flex-col items-center gap-inner">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
      {failed && (
        <Notice tone="error" live className="w-full text-start">
          {t("demo.failed")}
        </Notice>
      )}
      <Submit ready={ready} />
    </form>
  );
}

// One client per page, created on first use.
let supabaseClient: Promise<ReturnType<typeof import("@/lib/supabase/client").createClient>> | undefined;
function loadSupabase() {
  supabaseClient ??= import("@/lib/supabase/client").then((m) => m.createClient());
  supabaseClient.catch(() => (supabaseClient = undefined)); // a failed load can be tried again
  return supabaseClient;
}

// Before the page is ready (scripts still loading) a tap would do nothing: the button waits, off.
const noSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// useFormStatus reads the form it's inside, so the button is its own component.
function Submit({ ready }: { ready: boolean }) {
  const { t } = useT();
  const { pending } = useFormStatus();
  const off = pending || !ready;
  return (
    <button
      type="submit"
      disabled={off}
      aria-disabled={off}
      className="inline-flex min-h-11 items-center justify-center rounded-lg px-inner text-sm font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
    >
      {!ready ? t("demo.loading") : pending ? t("demo.settingUp") : t("demo.tryDemo")}
    </button>
  );
}
