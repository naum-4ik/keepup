"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";

type Props = {
  autoComplete: "current-password" | "new-password";
  invalid: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  // With the form's noValidate: no browser bubble, but assistive tech still hears "required".
  required?: boolean;
};

// A password field with a show/hide eye. Controlled, so the value survives the form reset React does
// after a server action: an error ("Use at least 8 characters") doesn't make you type it again.
export function PasswordInput({ autoComplete, invalid, describedBy, autoFocus, required }: Props) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 rounded-xl pe-11 ps-3"
        required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        aria-label={show ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
        className="absolute top-0 end-0 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
