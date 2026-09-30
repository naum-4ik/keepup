import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { safeNextPath, withNext } from "@/lib/paths";
import { AuthCard } from "./auth-card";
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
    <AuthCard
      title="Welcome back"
      subtitle="Keep up your habits, and do the ones that matter with your family."
      next={nextPath}
      googleEnabled={googleEnabled}
      footer={{ text: "Don't have an account?", linkLabel: "Sign up", href: withNext("/signup", nextPath) }}
    >
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
