import Link from "next/link";

// The one consent line (no checkbox): sign-in, sign-up, onboarding and the demo. The policy is public
// (/privacy), so the link works signed out too.
export function PrivacyConsent() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      By continuing, you agree to the{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
        Privacy Policy
      </Link>
    </p>
  );
}
