import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AuthErrorReason } from "@/lib/auth-errors";

function isAuthErrorReason(value: string | undefined): value is AuthErrorReason {
  return value === "expired" || value === "denied" || value === "unknown";
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason: rawReason } = await searchParams;
  const reason = isAuthErrorReason(rawReason) ? rawReason : null;

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
      {reason !== "denied" && (
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
