"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { describedBy } from "@/lib/field-error";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN } from "@/lib/password";
import { submitCredentials } from "../login/actions";
import { PasswordInput } from "../login/password-input";
import type { LoginState } from "../login/state";

const initialState: LoginState = { status: "idle" };

export function SignupForm({ next, signInHref }: { next: string; signInHref: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(submitCredentials, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.status === "error" ? state : null;
  // Each message sits beside its field ("Sign in instead" with the address); one about neither field
  // (too many tries, a server error) is the form's, above the button.
  const emailError = error && (error.field === "email" || error.accountExists) ? error : null;
  const passwordError = error?.field === "password" ? error : null;
  const formError = error && !emailError && !passwordError ? error : null;
  useFocusFirstInvalid(formRef, state);

  if (state.status === "confirm") {
    return (
      <p role="status" className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">
        {state.message}
      </p>
    );
  }

  return (
    // noValidate: the server answers in the app's own words instead of the browser's bubbles.
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-item">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="signup" />

      <Label htmlFor="email" className="font-semibold">
        {t("auth.email")}
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        dir="ltr"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        placeholder={t("auth.emailPlaceholder")}
        className="h-11 rounded-xl px-3"
        defaultValue={error?.email}
        required
        aria-invalid={Boolean(emailError)}
        aria-describedby={emailError ? "signup-error" : undefined}
      />
      {emailError && (
        <p id="signup-error" className="-mt-1 text-sm text-destructive">
          {emailError.message}{" "}
          {emailError.accountExists && (
            <Link href={signInHref} className="font-semibold text-primary hover:underline">
              {t("auth.signup.signInInstead")}
            </Link>
          )}
        </p>
      )}

      <Label htmlFor="password" className="font-semibold">
        {t("auth.password")}
      </Label>
      <PasswordInput
        autoComplete="new-password"
        required
        invalid={Boolean(passwordError)}
        describedBy={describedBy(!passwordError && "password-rule", passwordError && "signup-error")}
      />
      {/* The rule until the password breaks it; then what's wrong with it, in the same place. */}
      {passwordError ? (
        <p id="signup-error" className="-mt-1 text-sm text-destructive">
          {passwordError.message}
        </p>
      ) : (
        <p id="password-rule" className="-mt-1 text-xs text-muted-foreground">
          {t("auth.signup.passwordRule", { min: PASSWORD_MIN })}
        </p>
      )}

      {formError && (
        <Notice tone="error" live>
          <span id="signup-error">{formError.message}</span>
        </Notice>
      )}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? t("auth.signup.creating") : t("auth.signup.create")}
      </Button>
    </form>
  );
}
