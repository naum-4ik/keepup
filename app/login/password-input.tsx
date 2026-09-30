"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  autoComplete: "current-password" | "new-password";
  invalid: boolean;
  describedBy?: string;
  autoFocus?: boolean;
};

// A password field with a show/hide eye.
export function PasswordInput({ autoComplete, invalid, describedBy, autoFocus }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="h-11 rounded-xl pr-11 pl-3"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
        className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
