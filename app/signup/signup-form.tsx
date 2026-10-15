"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN } from "@/lib/password";
import { cn } from "@/lib/utils";
import { submitCredentials } from "../login/actions";
import { PasswordInput } from "../login/password-input";
import type { LoginState } from "../login/state";

const initialState: LoginState = { status: "idle" };

export function SignupForm({ next, signInHref }: { next: string; signInHref: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(submitCredentials, initialState);
  const error = state.status === "error" ? state : null;
  const emailInvalid = Boolean(error && error.field !== "password");
  const passwordInvalid = Boolean(error && error.field !== "email");

  if (state.status === "confirm") {
    return (
      <p role="status" className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">
        {state.message}
      </p>
    );
  }

  return (
    // noValidate: the server answers in the app's own words instead of the browser's bubbles.
    <form action={action} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="signup" />

      <Label htmlFor="email" className="font-semibold">
        {t("auth.email")}
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        placeholder={t("auth.emailPlaceholder")}
        className="h-11 rounded-xl px-3"
        defaultValue={error?.email}
        aria-invalid={emailInvalid}
        aria-describedby={emailInvalid ? "signup-error" : undefined}
      />

      <Label htmlFor="password" className="font-semibold">
        {t("auth.password")}
      </Label>
      <PasswordInput
        autoComplete="new-password"
        invalid={passwordInvalid}
        describedBy={cn(error?.field !== "password" && "password-rule", passwordInvalid && "signup-error") || undefined}
      />
      <p id="password-rule" hidden={error?.field === "password"} className="-mt-1 text-xs text-muted-foreground">
        {t("auth.signup.passwordRule", { min: PASSWORD_MIN })}
      </p>

      {error && (
        <p id="signup-error" role="alert" className="text-sm text-destructive">
          {error.message}{" "}
          {error.accountExists && (
            <Link href={signInHref} className="font-semibold text-primary hover:underline">
              {t("auth.signup.signInInstead")}
            </Link>
          )}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? t("auth.signup.creating") : t("auth.signup.create")}
      </Button>
    </form>
  );
}
