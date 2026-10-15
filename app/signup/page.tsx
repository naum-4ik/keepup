import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { safeNextPath, withNext } from "@/lib/paths";
import { AuthCard } from "../login/auth-card";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  const nextPath = safeNextPath(params.next);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const signInHref = withNext("/login", nextPath);

  return (
    <AuthCard
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      next={nextPath}
      googleEnabled={googleEnabled}
      footer={{ text: t("auth.signup.haveAccount"), linkLabel: t("auth.signIn"), href: signInHref }}
    >
      <SignupForm next={nextPath} signInHref={signInHref} />
    </AuthCard>
  );
}
