import Link from "next/link";
import { SproutIcon } from "@/components/sprout-icon";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-item px-4 text-center">
      <div aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-primary">
        <SproutIcon className="size-8" />
      </div>
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFound.text")}</p>
      <Button asChild>
        <Link href="/">{t("notFound.backHome")}</Link>
      </Button>
    </main>
  );
}
