import Image from "next/image";
import Link from "next/link";
import { GoogleIcon } from "@/components/google-icon";
import { TryDemoButton } from "@/components/demo/try-demo-button";
import { PrivacyConsent } from "@/components/privacy-consent";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { signInWithGoogle } from "./actions";

type Props = {
  title: string;
  subtitle: string;
  next: string;
  googleEnabled: boolean;
  footer: { text: string; linkLabel: string; href: string };
  children: React.ReactNode;
};

// The sign-in and sign-up screens share this layout: title, the email form, then Google, then the
// link to the other screen, then the demo, then the consent line, once per screen. No card around it
// (docs/design.md: a form is not a card); the three spacing levels.
export async function AuthCard({ title, subtitle, next, googleEnabled, footer, children }: Props) {
  const { t } = await getT();
  return (
    <main className="mx-auto flex w-full min-h-dvh max-w-sm flex-col justify-center gap-section px-4 py-section">
      <div className="flex flex-col items-center gap-inner text-center">
        {/* Decorative and small: loaded at once but not preloaded, so it doesn't compete with the CSS and the text. */}
        <Image src="/icons/icon-192.png" alt="" width={56} height={56} loading="eager" className="rounded-2xl" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-item">
        {children}

        {googleEnabled && (
          <>
            <div className="flex items-center gap-inner">
              <div aria-hidden="true" className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">{t("auth.or")}</span>
              <div aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <Button type="submit" variant="outline" size="lg" className="w-full justify-center gap-inner bg-card hover:bg-muted">
                <GoogleIcon className="size-5" />
                {t("auth.continueGoogle")}
              </Button>
            </form>
          </>
        )}
      </div>

      <div className="flex flex-col gap-item text-center">
        <p className="text-sm text-muted-foreground">
          {footer.text}{" "}
          <Link href={footer.href} className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            {footer.linkLabel}
          </Link>
        </p>
        <TryDemoButton />
        <PrivacyConsent />
      </div>
    </main>
  );
}
