"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidEmail } from "@/lib/email";
import { submitCredentials } from "./actions";
import { PasswordInput } from "./password-input";
import type { LoginState } from "./state";

const initialState: LoginState = { status: "idle" };

// Email first, then the password: one question at a time, and the email step works the same whether
// or not the person remembers how they signed up.
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(submitCredentials, initialState);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  // An error belongs to the attempt that caused it: going back to change the email dismisses it.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);
  const error = step === "password" && state.status === "error" && state !== dismissed ? state : null;

  if (step === "email") {
    return (
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault(); // step 1 stays in the browser; only the password step talks to the server
          const trimmed = email.trim();
          if (!isValidEmail(trimmed)) return setEmailError("Enter a valid email address.");
          setEmail(trimmed);
          setEmailError(null);
          setStep("password");
        }}
      >
        <Label htmlFor="email" className="font-semibold">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          placeholder="you@example.com"
          className="h-11 rounded-xl px-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "login-error" : undefined}
        />
        {emailError && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
        <Button type="submit" className="h-11">
          Continue
        </Button>
      </form>
    );
  }

  return (
    // noValidate: the server answers in the app's own words instead of the browser's bubbles.
    <form action={action} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="signin" />

      <Label htmlFor="email" className="font-semibold">
        Email
      </Label>
      <div className="flex items-center gap-2">
        {/* Read-only but real, so password managers pair the saved password with this email. */}
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          readOnly
          value={email}
          className="h-11 flex-1 rounded-xl bg-muted px-3 text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setShowForgot(false);
            setDismissed(state);
          }}
          className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent"
        >
          Change
        </button>
      </div>

      <Label htmlFor="password" className="font-semibold">
        Password
      </Label>
      <PasswordInput
        autoComplete="current-password"
        autoFocus
        invalid={Boolean(error)}
        describedBy={error ? "login-error" : undefined}
      />
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
          <p className="text-sm text-muted-foreground">Sign in with Google using the same email, or ask Ilya to reset it.</p>
        )}
      </div>

      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
