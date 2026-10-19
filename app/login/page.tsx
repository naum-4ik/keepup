import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorReason } from "@/lib/auth-errors";
import { getT } from "@/lib/i18n/server";
import { safeNextPath, withNext } from "@/lib/paths";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("meta.pageTitle", { page: t("meta.signInPage") }) };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  const reason = authErrorReason(params);
  if (reason) redirect(`/auth/error?reason=${reason}`);

  const nextPath = safeNextPath(params.next);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      next={nextPath}
      googleEnabled={googleEnabled}
      footer={{ text: t("auth.login.noAccount"), linkLabel: t("auth.login.signUp"), href: withNext("/signup", nextPath) }}
    >
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
