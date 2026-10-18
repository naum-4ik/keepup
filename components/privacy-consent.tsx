import Link from "next/link";
import { useTranslations } from "next-intl";

// The one consent line (no checkbox): sign-in, sign-up, onboarding and the demo. The policy is public
// (/privacy), so the link works signed out too.
export function PrivacyConsent() {
  const t = useTranslations("common");
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t.rich("privacyConsent", {
        link: (c) => (
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {c}
          </Link>
        ),
      })}
    </p>
  );
}
