import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/paths";
import { signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";
import { GoogleIcon } from "@/components/google-icon";

export default async function LoginPage({
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

  const nextPath = safeNextPath(params.next);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">Sign in to Keepup</h1>
        <p className="text-sm text-muted-foreground">Habits, together.</p>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-soft">
        {googleEnabled && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={nextPath} />
            <Button type="submit" variant="outline" className="h-11 w-full">
              <GoogleIcon className="size-5" />
              Continue with Google
            </Button>
          </form>
        )}
        <LoginForm next={nextPath} />
      </div>
    </main>
  );
}
