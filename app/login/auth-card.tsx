import Image from "next/image";
import Link from "next/link";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

type Props = {
  title: string;
  subtitle: string;
  next: string;
  googleEnabled: boolean;
  footer: { text: string; linkLabel: string; href: string };
  children: React.ReactNode;
};

// The sign-in and sign-up screens share this card: title, the email form, then Google, then the
// link to the other screen.
export function AuthCard({ title, subtitle, next, googleEnabled, footer, children }: Props) {
  return (
    <main className="mx-auto flex w-full min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-soft">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-2xl" priority />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3">
              <div aria-hidden="true" className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">OR</span>
              <div aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <Button type="submit" variant="outline" className="h-12 w-full justify-center gap-3 bg-card hover:bg-muted">
                <GoogleIcon className="size-5" />
                Continue with Google
              </Button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {footer.text}{" "}
          <Link href={footer.href} className="font-semibold text-primary hover:underline">
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
