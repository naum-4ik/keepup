"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { startDemo } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";
import { SETTING_UP, TRY_IT } from "@/lib/demo-copy";

// "Try it" on the landing page: the device's time zone goes along, so the demo's days match the visitor's.
export function TryDemoButton() {
  const zone = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (zone.current) zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  return (
    <form action={startDemo} className="flex flex-col gap-2">
      <input ref={zone} type="hidden" name="timezone" defaultValue="" />
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
