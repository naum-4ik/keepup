import { redirect } from "next/navigation";
import { isFreshRecovery } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

// Where a reset link lands (via /auth/confirm), already signed in by it. Signed out → sign in. Signed
// in some other way, or the link was opened more than 15 minutes ago → "That link didn't work", which
// says to ask for a new one: the likely visitor here followed a reset link, so that is the next step.
export default async function NewPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  if (!isFreshRecovery(data.claims, new Date())) redirect("/auth/error?reason=link");

  return (
    <main className="mx-auto flex w-full min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">You&apos;ll sign in with it from now on.</p>
        </div>
        <NewPasswordForm email={typeof data.claims.email === "string" ? data.claims.email : ""} />
      </div>
    </main>
  );
}
