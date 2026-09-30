"use client";

import { Eye, EyeOff } from "lucide-react";
import { GoogleIcon } from "@/components/google-icon";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN, type CredentialsMode } from "@/lib/password";
import { cn } from "@/lib/utils";
import { signInWithGoogle, submitCredentials } from "./actions";
import type { LoginState } from "./state";

const initialState: LoginState = { status: "idle" };

const MODES: { value: CredentialsMode; label: string }[] = [
  { value: "signin", label: "Sign in" },
  { value: "signup", label: "Create account" },
];

// The whole sign-in card: the Sign in / Create account tabs on top (they apply to Google too, which
// signs in or creates the account either way), then Google, then email + password.
export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(submitCredentials, initialState);
  const [mode, setMode] = useState<CredentialsMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const error = state.status === "error" && state.mode === mode ? state : null;
  const emailInvalid = Boolean(error && error.field !== "password");
  const passwordInvalid = Boolean(error && error.field !== "email");
  const signup = mode === "signup";

  function chooseMode(m: CredentialsMode) {
    setMode(m);
    setShowForgot(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Sign in or create an account" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => chooseMode(m.value)}
            className={cn(
              "min-h-10 rounded-lg text-sm font-semibold transition-colors",
              mode === m.value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {googleEnabled && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="h-12 w-full justify-center gap-3 bg-card hover:bg-muted">
              <GoogleIcon className="size-5" />
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {/* noValidate: the server checks every field and answers in the app's own words, instead of the
          browser's validation bubbles (which look and read differently on every phone). */}
      <form action={action} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />

        <Label htmlFor="email" className="font-semibold">
          Email
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
          placeholder="you@example.com"
          className="h-11 rounded-xl px-3"
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={emailInvalid}
          aria-describedby={emailInvalid ? "login-error" : undefined}
        />

        <Label htmlFor="password" className="font-semibold">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            className="h-11 rounded-xl pr-11 pl-3"
            aria-invalid={passwordInvalid}
            aria-describedby={cn(signup && "password-rule", passwordInvalid && "login-error") || undefined}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>

        {signup ? (
          <p id="password-rule" hidden={error?.field === "password"} className="-mt-1 text-xs text-muted-foreground">
            At least {PASSWORD_MIN} characters.
          </p>
        ) : (
          <div className="-mt-2 flex flex-col">
            <button
              type="button"
              aria-expanded={showForgot}
              onClick={() => setShowForgot((s) => !s)}
              className="min-h-11 self-start text-sm font-semibold text-primary hover:underline"
            >
              Forgot password?
            </button>
            {showForgot && (
              <p className="text-sm text-muted-foreground">
                Sign in with Google using the same email, or ask Ilya to reset it.
              </p>
            )}
          </div>
        )}

        {error && (
          <div id="login-error" role="alert" className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
            <span>{error.message}</span>
            {error.accountExists && (
              <button
                type="button"
                onClick={() => chooseMode("signin")}
                className="min-h-11 font-semibold text-primary hover:underline"
              >
                Sign in instead
              </button>
            )}
          </div>
        )}

        <Button type="submit" disabled={pending} className="h-11">
          {pending ? (signup ? "Creating your account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
