"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

// Error boundaries must be Client Components. Never render `error.message` or `error.digest`
// here: in production that can be a generic identifier, but nothing about the failure should
// be shown to the user regardless.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t("errorPage.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorPage.text")}</p>
      <Button className="h-11" onClick={() => reset()}>
        {t("common.tryAgain")}
      </Button>
      <Button asChild variant="ghost" className="h-11">
        <Link href="/today">{t("errorPage.backToToday")}</Link>
      </Button>
    </main>
  );
}
