import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TryDemoButton } from "@/components/demo/try-demo-button";
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
  if (data?.claims) redirect(params.moved === "1" ? "/today?moved=1" : "/today");

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
        <p className="mt-3">Keep up your habits, and do the ones that matter with your family.</p>
      </div>
      <div className="flex flex-col gap-3">
        {params.deleted === "1" && <p role="status" className="text-sm text-muted-foreground">{DELETED_NOTE}</p>}
        <Button asChild size="lg" className="h-12 w-full">
          <Link href="/signup">Get started</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
        {/* A seeded demo account, no sign-up (M6 PR 3): a quiet way to look around first. */}
        <TryDemoButton />
      </div>
    </main>
  );
}
