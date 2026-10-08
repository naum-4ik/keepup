import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AuthErrorReason } from "@/lib/auth-errors";

// "link": a reset or confirm email link (/auth/confirm, /auth/new-password) that didn't work.
type Reason = AuthErrorReason | "link";

function isReason(value: string | undefined): value is Reason {
  return value === "expired" || value === "denied" || value === "unknown" || value === "link";
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason: rawReason } = await searchParams;
  const reason = isReason(rawReason) ? rawReason : null;

  if (reason === "link") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">That link didn&apos;t work</h1>
        <p className="text-sm text-muted-foreground">
          Email links work once, for an hour. Sign in, or ask for a new reset link from the sign-in screen.
        </p>
        <Button asChild className="h-11">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Sign-in didn&apos;t work</h1>
      {reason === "expired" && (
        <p className="text-sm text-muted-foreground">
          This link was already used or has expired. Sign in again.
        </p>
      )}
      {reason === "denied" && (
        <p className="text-sm text-muted-foreground">
          Sign-in was cancelled or not allowed. Try again.
        </p>
      )}
      {/* "unknown": the provider or our auth service failed (e.g. Google's code exchange), not the link. */}
      {reason === "unknown" && (
        <p className="text-sm text-muted-foreground">
          Something went wrong while signing you in. Try again in a moment.
        </p>
      )}
      {(reason === null || reason === "expired") && (
        <p className="text-sm text-muted-foreground">
          Links expire after an hour and must be opened in the same browser you requested them from.
        </p>
      )}
      <Button asChild className="h-11">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </main>
  );
}
