import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TryDemoButton } from "@/components/demo/try-demo-button";
import { DEMO_FAILED } from "@/lib/demo-copy";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { DELETED_NOTE } from "@/lib/my-data";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center">
        <Image src="/icons/icon-192.png" alt="" width={72} height={72} className="mb-4 rounded-2xl" priority />
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-foreground">Keep</span>
          <span className="text-primary">up</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Habits, together.</p>
      </div>
      {/* Most visitors here are new (signed-in people go straight to Today), so the one button signs up. */}
      <div className="flex flex-col gap-3">
        {params.deleted === "1" && <p role="status" className="text-sm text-muted-foreground">{DELETED_NOTE}</p>}
        {params.demo === "failed" && <p role="alert" className="text-sm text-destructive">{DEMO_FAILED}</p>}
        <Button asChild size="lg" className="h-12 w-full">
          <Link href="/signup">Get started</Link>
        </Button>
        {/* A seeded demo account, no sign-up (M6 PR 3); the full landing comes in PR 4. */}
        <TryDemoButton />
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
