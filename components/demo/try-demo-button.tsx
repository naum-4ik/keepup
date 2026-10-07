"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { startDemo } from "@/app/demo/actions";
import { DEMO_FAILED, JUST_LOOKING, SETTING_UP, TRY_DEMO } from "@/lib/demo-copy";
import { createClient } from "@/lib/supabase/client";
import { runTryIt } from "@/lib/try-demo";

// "Try the demo" on the landing page: a quiet link-style button under Sign in. The anonymous sign-in happens here, in the browser, so Supabase's per-IP
// limit counts each visitor's own IP (from the server, every visitor would share Vercel's). Then the
// server seeds the demo. The device's time zone goes along, so the demo's days match the visitor's.
export function TryDemoButton() {
  const zone = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (zone.current) zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // A form action: useFormStatus stays pending through both steps.
  async function tryIt(formData: FormData) {
    setFailed(false);
    const supabase = createClient();
    const result = await runTryIt({
      hasSession: async () => Boolean((await supabase.auth.getSession()).data.session),
      signIn: () => supabase.auth.signInAnonymously(),
      start: () => startDemo(formData),
      signOut: async () => void (await supabase.auth.signOut({ scope: "local" })),
      rethrow: unstable_rethrow,
    });
    if (result === "failed") setFailed(true);
  }

  return (
    <form action={tryIt} className="flex flex-col gap-1">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
      {failed && <p role="alert" className="text-sm text-destructive">{DEMO_FAILED}</p>}
      <p className="text-sm text-muted-foreground">
        {JUST_LOOKING} <Submit />
      </p>
      {/* Plain text until /privacy exists (M6), then a link. Same line as onboarding's: the seed onboards. */}
      <p className="text-center text-xs text-muted-foreground">By continuing, you agree to the Privacy Policy</p>
    </form>
  );
}

// useFormStatus reads the form it's inside, so the button is its own component.
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
    >
      {pending ? SETTING_UP : TRY_DEMO}
    </button>
  );
}
