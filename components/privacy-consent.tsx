import Link from "next/link";
import { useTranslations } from "next-intl";

// The one consent line (no checkbox): sign-in, sign-up, onboarding and the demo. The terms and the
// policy are public (/terms, /privacy), so the links work signed out too.
export function PrivacyConsent() {
  const t = useTranslations("common");
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t.rich("privacyConsent", {
        terms: (c) => (
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            {c}
          </Link>
        ),
        link: (c) => (
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {c}
          </Link>
        ),
      })}
    </p>
  );
}
