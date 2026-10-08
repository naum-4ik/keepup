"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidEmail } from "@/lib/email";
import { requestPasswordReset, submitCredentials } from "./actions";
import { PasswordInput } from "./password-input";
import type { LoginState } from "./state";

const initialState: LoginState = { status: "idle" };
const NEED_EMAIL = "Type your email above, then tap Forgot password? again.";
const FORGOT_STATUS_ID = "forgot-status";

// Email first, then the password: one question at a time, and the email step works the same whether
// or not the person remembers how they signed up.
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(submitCredentials, initialState);
  const [reset, resetAction] = useActionState(requestPasswordReset, initialState);
  const [resetPending, startReset] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [needEmail, setNeedEmail] = useState(false);
  // An error belongs to the attempt that caused it: going back to change the email dismisses it.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);
  const error = step === "password" && state.status === "error" && state !== dismissed ? state : null;

  // The email field takes focus once the hint is there, so a screen reader reads the hint with it.
  useEffect(() => {
    if (needEmail) emailRef.current?.focus();
  }, [needEmail]);

  // Forgot password? sends the link at once to the email typed above; with none, it asks for one.
  // While sending, the button stays focusable (aria-disabled, not disabled) and a second tap does nothing.
  function forgotPassword() {
    if (resetPending) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setNeedEmail(true);
      emailRef.current?.focus();
      return;
    }
    setNeedEmail(false);
    const data = new FormData();
    data.set("email", trimmed);
    startReset(() => resetAction(data));
  }

  const sent = !needEmail && reset.status === "reset_sent" && reset.email === email.trim();
  const forgot = (
    <div className="flex flex-col">
      <button
        type="button"
        aria-disabled={resetPending}
        onClick={forgotPassword}
        className="min-h-11 self-start text-sm font-semibold text-primary hover:underline aria-disabled:opacity-60"
      >
        {resetPending ? "Sending…" : "Forgot password?"}
      </button>
      {/* One live region, always in the page, so the hint and the answer are announced when they appear. */}
      <p id={FORGOT_STATUS_ID} role="status" className={needEmail ? "text-sm text-muted-foreground" : "text-sm"}>
        {needEmail ? NEED_EMAIL : sent ? reset.message : null}
      </p>
      {sent && <p className="text-sm text-muted-foreground">Or sign in with Google using the same email.</p>}
    </div>
  );

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
          ref={emailRef}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setNeedEmail(false);
          }}
          aria-invalid={Boolean(emailError)}
          aria-describedby={[emailError && "login-error", needEmail && FORGOT_STATUS_ID].filter(Boolean).join(" ") || undefined}
        />
        {emailError && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
        <Button type="submit" className="h-11">
          Continue
        </Button>
        {forgot}
      </form>
    );
  }

  return (
    <>
      {/* noValidate: the server answers in the app's own words instead of the browser's bubbles. */}
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
              setNeedEmail(false);
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
        <div className="-mt-2">{forgot}</div>

        {error && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
