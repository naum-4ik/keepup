import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TryDemoButton } from "@/components/demo/try-demo-button";
import { PrivacyConsent } from "@/components/privacy-consent";
import { Notice } from "@/components/ui/notice";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/log";
import { isLandingVisit } from "@/lib/landing-visit";

// What a search result and the browser tab say about the landing; other pages keep "Keepup" or their own.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("meta.title") };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(params.moved === "1" ? "/today?moved=1" : "/today");

  const reason = authErrorReason(params);
  if (reason) redirect(`/auth/error?reason=${reason}`);

  // A signed-out visit, counted on the server: Faro starts only after load (then up to 2 s idle), so a
  // quick bounce has no Faro session. Nothing about the visitor (no IP, no place): only that the landing
  // was served. Prefetches and bots aren't visits (lib/landing-visit.ts).
  if (isLandingVisit(await headers())) track("landing_viewed", {});

  // One screen, one filled button (design pass PR 6): the pitch, "Start your first streak", then the
  // quieter ways in: the demo (a text button) and Sign in (a link), each a 44 px tap target.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-section px-4 py-section text-center">
      <div className="flex flex-col items-center gap-inner">
        {/* Decorative and small: loaded at once (it is on the first screen) but not preloaded, so it doesn't compete with the CSS and the text (the LCP). */}
        <Image src="/icons/logo-192.png" alt="" width={72} height={72} loading="eager" className="rounded-2xl" />
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-foreground">Keep</span>
          <span className="text-primary">up</span>
        </h1>
        <p className="text-muted-foreground">{t("common.tagline")}</p>
        {/* The same pitch as the sign-in screen. */}
        <p>{t("auth.login.subtitle")}</p>
      </div>
      <div className="flex flex-col gap-item">
        {params.deleted === "1" && (
          <Notice tone="success" live className="text-start">
            {t("myData.deletedNote")}
          </Notice>
        )}
        <Button asChild size="lg" className="w-full">
          <Link href="/signup">{t("landing.start")}</Link>
        </Button>
        {/* A seeded demo account, no sign-up (M6 PR 3): a quiet way to look around first. */}
        <TryDemoButton />
        <p className="text-sm text-muted-foreground">
          {t("auth.signup.haveAccount")}{" "}
          <Link href="/login" className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
        <PrivacyConsent />
      </div>
    </main>
  );
}
