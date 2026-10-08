"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Error boundaries must be Client Components. Never render `error.message` or `error.digest`
// here: in production that can be a generic identifier, but nothing about the failure should
// be shown to the user regardless.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We hit a snag loading this page. Try again, or head back to Today.
      </p>
      <Button className="h-11" onClick={() => reset()}>
        Try again
      </Button>
      <Button asChild variant="ghost" className="h-11">
        <Link href="/today">Back to Today</Link>
      </Button>
    </main>
  );
}
