import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AuthErrorReason } from "@/lib/auth-errors";
import { getT } from "@/lib/i18n/server";

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
  const { t } = await getT();
  const { reason: rawReason } = await searchParams;
  const reason = isReason(rawReason) ? rawReason : null;

  if (reason === "link") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">{t("auth.error.linkTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.error.linkBody")}
        </p>
        <Button asChild className="h-11">
          <Link href="/login">{t("auth.error.back")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">{t("auth.error.title")}</h1>
      {reason === "expired" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.error.expired")}
        </p>
      )}
      {reason === "denied" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.error.denied")}
        </p>
      )}
      {/* "unknown": the provider or our auth service failed (e.g. Google's code exchange), not the link. */}
      {reason === "unknown" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.error.unknown")}
        </p>
      )}
      {(reason === null || reason === "expired") && (
        <p className="text-sm text-muted-foreground">
          {t("auth.error.expiry")}
        </p>
      )}
      <Button asChild className="h-11">
        <Link href="/login">{t("auth.error.back")}</Link>
      </Button>
    </main>
  );
}
