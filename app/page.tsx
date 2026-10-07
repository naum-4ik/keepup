import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TryDemoButton } from "@/components/demo/try-demo-button";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingSection } from "@/components/landing/landing-section";
import { DEMO_FAILED } from "@/lib/demo-copy";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { DELETED_NOTE } from "@/lib/my-data";
import { LANDING } from "@/lib/landing-copy";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  const reason = authErrorReason(params);
  if (reason) redirect(`/auth/error?reason=${reason}`);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4 pt-16 pb-10 sm:gap-20 sm:pt-24">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 text-center">
        <div className="flex flex-col items-center">
          <Image src="/icons/icon-192.png" alt="" width={72} height={72} className="mb-4 rounded-2xl" priority />
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-foreground">Keep</span>
            <span className="text-primary">up</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Habits, together.</p>
          <p className="mt-3 text-lg">{LANDING.hero.sub}</p>
        </div>
        <div className="flex flex-col gap-3">
          {params.deleted === "1" && <p role="status" className="text-sm text-muted-foreground">{DELETED_NOTE}</p>}
          {params.demo === "failed" && <p role="alert" className="text-sm text-destructive">{DEMO_FAILED}</p>}
          {/* A seeded demo account, no sign-up (M6 PR 3): the quickest way to see Keepup. */}
          <TryDemoButton />
          <Button asChild size="lg" variant="outline" className="h-12 w-full">
            <Link href="/signup">{LANDING.hero.secondary}</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {LANDING.hero.signIn}
            </Link>
          </p>
        </div>
      </div>
      {LANDING.sections.map(({ key, title, body, image, alt }, i) => (
        <LandingSection key={key} title={title} body={body} image={image} alt={alt} flip={i % 2 === 1} />
      ))}
      <section aria-labelledby="landing-privacy" className="mx-auto w-full max-w-md rounded-3xl bg-card p-6 shadow-sm">
        <h2 id="landing-privacy" className="text-2xl font-bold tracking-tight">
          {LANDING.privacy.title}
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {LANDING.privacy.points.map((point) => (
            <li key={point} className="flex gap-3">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-done" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
      <LandingFooter />
    </main>
  );
}
