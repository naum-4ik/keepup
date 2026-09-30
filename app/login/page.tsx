import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/paths";
import { LoginForm } from "./login-form";

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
    <main className="mx-auto flex w-full min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          <span className="text-foreground">Keep</span>
          <span className="text-primary">up</span>
          <span className="sr-only"> — sign in</span>
        </h1>
        <p className="text-sm text-muted-foreground">Habits, together.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4 self-stretch rounded-2xl bg-card p-6 shadow-soft">
        <LoginForm next={nextPath} googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
