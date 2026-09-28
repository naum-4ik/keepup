import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Keepup</h1>
        <p className="mt-2 text-muted-foreground">Habits, together.</p>
      </div>
      <Button asChild size="lg">
        <Link href="/login">Sign in</Link>
      </Button>
    </main>
  );
}
