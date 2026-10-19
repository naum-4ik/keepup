"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { startDemo } from "@/app/demo/actions";
import { Notice } from "@/components/ui/notice";
import { runTryIt } from "@/lib/try-demo";
import { useT } from "@/lib/i18n/client";

// "Try a demo with sample habits" on the landing page, and on sign-in and sign-up (someone who followed a
// link or tapped a step too far can still just look around): a quiet text button, 44 px tall, never the
// page's filled button. The consent line is the page's own (it covers signing up too). The anonymous sign-in happens here, in the browser, so Supabase's per-IP
// limit counts each visitor's own IP (from the server, every visitor would share Vercel's). Then the
// server seeds the demo. The device's time zone goes along, so the demo's days match the visitor's.
// ?demo=failed: the seed action couldn't start the demo (app/demo/actions.ts redirects here). A new
// try takes it out of the address (Next keeps useSearchParams in step), so the old failure goes.
// The Supabase browser client's code (about 60 KB gzipped) loads only when someone reaches for the
// button (pointer over it, focus, touch) or taps it, never with the page, so it doesn't slow the first
// paint. The client itself is created only on the tap.
export function TryDemoButton() {
  const { t } = useT();
  const zone = useRef<HTMLInputElement>(null);
  const failedBefore = useSearchParams().get("demo") === "failed";
  // "failed": the demo didn't start (tap again). "reload": its script didn't load; the bundler keeps
  // that failure for the page's lifetime, so tapping again can't help: the next step is a reload.
  const [failedHere, setFailedHere] = useState<"failed" | "reload" | null>(null);
  const failed = failedHere ?? (failedBefore ? "failed" : null);
  const ready = useHydrated();
  useEffect(() => {
    if (zone.current) zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // A form action: useFormStatus stays pending through both steps.
  async function tryIt(formData: FormData) {
    setFailedHere(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("demo")) {
      url.searchParams.delete("demo");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    let supabase: ReturnType<Awaited<ReturnType<typeof loadSupabase>>["createClient"]>;
    try {
      supabase = (await loadSupabase()).createClient();
    } catch (e) {
      console.error("demo: loading the client", e);
      setFailedHere("reload"); // the script didn't load (offline, a new deploy)
      return;
    }
    const result = await runTryIt({
      hasSession: async () => Boolean((await supabase.auth.getSession()).data.session),
      signIn: () => supabase.auth.signInAnonymously(),
      start: () => startDemo(formData),
      signOut: async () => void (await supabase.auth.signOut({ scope: "local" })),
      rethrow: unstable_rethrow,
    });
    if (result === "failed") setFailedHere("failed");
  }

  return (
    <form action={tryIt} className="flex flex-col items-center gap-inner">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
      {failed === "failed" && (
        <Notice tone="error" live className="w-full text-start">
          {t("demo.failed")}
        </Notice>
      )}
      {failed === "reload" && (
        <Notice
          tone="error"
          live
          className="w-full text-start"
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="-my-2 flex min-h-11 items-center rounded-lg px-inner font-bold underline underline-offset-2 hover:bg-background/60"
            >
              {t("demo.reload")}
            </button>
          }
        >
          {t("demo.loadFailed")}
        </Notice>
      )}
      <Submit ready={ready} />
    </form>
  );
}

// The module, fetched once. A failed fetch isn't retried: the bundler caches the failed chunk.
let supabaseModule: Promise<typeof import("@/lib/supabase/client")> | undefined;
function loadSupabase() {
  supabaseModule ??= import("@/lib/supabase/client");
  return supabaseModule;
}
const warmUp = () => void loadSupabase().catch(() => {});

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
      onPointerEnter={warmUp}
      onFocus={warmUp}
      onTouchStart={warmUp}
      className="inline-flex min-h-11 items-center justify-center rounded-lg px-inner text-sm font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
    >
      {!ready ? t("demo.loading") : pending ? t("demo.settingUp") : t("demo.tryDemo")}
    </button>
  );
}
