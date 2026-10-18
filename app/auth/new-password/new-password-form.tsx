"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { setNewPassword } from "@/app/login/actions";
import { PasswordInput } from "@/app/login/password-input";
import type { LoginState } from "@/app/login/state";

const initialState: LoginState = { status: "idle" };

export function NewPasswordForm({ email }: { email: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(setNewPassword, initialState);
  const error = state.status === "error" ? state.message : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-3">
      {/* So a password manager saves the new password for the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Label htmlFor="password" className="font-semibold">
        {t("auth.newPassword.label")}
      </Label>
      <PasswordInput autoComplete="new-password" autoFocus invalid={Boolean(error)} describedBy={error ? "new-password-error" : undefined} />
      {error && (
        <p id="new-password-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? t("common.saving") : t("auth.newPassword.save")}
      </Button>
    </form>
  );
}
