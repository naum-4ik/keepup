"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { startDemo } from "@/app/demo/actions";
import { PrivacyConsent } from "@/components/privacy-consent";
import { DEMO_FAILED, JUST_LOOKING, LOADING, SETTING_UP, TRY_DEMO } from "@/lib/demo-copy";
import { createClient } from "@/lib/supabase/client";
import { runTryIt } from "@/lib/try-demo";

// "Try the demo" on the landing page: a quiet link-style button under Sign in. The anonymous sign-in happens here, in the browser, so Supabase's per-IP
// limit counts each visitor's own IP (from the server, every visitor would share Vercel's). Then the
// server seeds the demo. The device's time zone goes along, so the demo's days match the visitor's.
// ?demo=failed: the seed action couldn't start the demo (app/demo/actions.ts redirects here). A new
// try takes it out of the address (Next keeps useSearchParams in step), so the old failure goes.
export function TryDemoButton() {
  const zone = useRef<HTMLInputElement>(null);
  const failedBefore = useSearchParams().get("demo") === "failed";
  const [failedHere, setFailedHere] = useState(false);
  const failed = failedHere || failedBefore;
  const ready = useHydrated();
  useEffect(() => {
    if (zone.current) zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // A form action: useFormStatus stays pending through both steps.
  async function tryIt(formData: FormData) {
    setFailedHere(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("demo")) {
      url.searchParams.delete("demo");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const supabase = createClient();
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
    <form action={tryIt} className="flex flex-col gap-1">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
      {failed && <p role="alert" className="text-sm text-destructive">{DEMO_FAILED}</p>}
      <p className="text-sm text-muted-foreground">
        {JUST_LOOKING} <Submit ready={ready} />
      </p>
      {/* Same line as onboarding's: the seed onboards. */}
      <PrivacyConsent />
    </form>
  );
}

// Before the page is ready (scripts still loading) a tap would do nothing: the button waits, off.
const noSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// useFormStatus reads the form it's inside, so the button is its own component.
function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  const off = pending || !ready;
  return (
    <button
      type="submit"
      disabled={off}
      aria-disabled={off}
      className="font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
    >
      {!ready ? LOADING : pending ? SETTING_UP : TRY_DEMO}
    </button>
  );
}
