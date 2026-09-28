import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">That sign-in link didn&apos;t work</h1>
      <p className="text-sm text-muted-foreground">
        Links expire after an hour and must be opened in the same browser you requested them from.
      </p>
      <Button asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </main>
  );
}
