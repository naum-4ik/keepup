import Link from "next/link";
import { SproutIcon } from "@/components/sprout-icon";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <div aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-primary">
        <SproutIcon className="size-8" />
      </div>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Button asChild className="h-11">
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
