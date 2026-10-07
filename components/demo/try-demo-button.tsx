"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startDemo } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";
import { DEMO_FAILED, SETTING_UP, TRY_IT } from "@/lib/demo-copy";
import { createClient } from "@/lib/supabase/client";

// "Try it" on the landing page. The anonymous sign-in happens here, in the browser, so Supabase's per-IP
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
    const { error } = await createClient().auth.signInAnonymously();
    if (error) return setFailed(true);
    await startDemo(formData);
  }

  return (
    <form action={tryIt} className="flex flex-col gap-2">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
      {failed && <p role="alert" className="text-sm text-destructive">{DEMO_FAILED}</p>}
      <Submit />
      {/* Plain text until /privacy exists (M6), then a link. Same line as onboarding's: the seed onboards. */}
      <p className="text-center text-xs text-muted-foreground">By continuing, you agree to the Privacy Policy</p>
    </form>
  );
}

// useFormStatus reads the form it's inside, so the button is its own component.
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-12 w-full" disabled={pending}>
      {pending ? SETTING_UP : TRY_IT}
    </Button>
  );
}
