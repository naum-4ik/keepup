"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// The submit of a "Continue with Google" form: while the server action hands over to Google it says
// so and is disabled (docs/design.md "States and feedback"), so a second tap doesn't start a second
// sign-in. useFormStatus reads the form it's inside, so it is its own component. The words come from
// the server page as props.
export function GoogleSubmit({
  icon,
  label,
  pendingLabel,
  ...props
}: { icon: ReactNode; label: string; pendingLabel: string } & Omit<ComponentProps<typeof Button>, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {icon}
      {pending ? pendingLabel : label}
    </Button>
  );
}
