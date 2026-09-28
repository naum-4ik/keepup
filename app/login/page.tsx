import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/paths";
import { signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Sign in to Keepup</h1>
        <p className="text-sm text-muted-foreground">Habits, together.</p>
      </div>
      {googleEnabled && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={nextPath} />
          <Button type="submit" variant="outline" className="w-full">
            Continue with Google
          </Button>
        </form>
      )}
      <LoginForm next={nextPath} />
    </main>
  );
}
