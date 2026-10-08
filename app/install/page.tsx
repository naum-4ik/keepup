import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { INSTALL_INTRO, INSTALL_REMINDERS, INSTALL_TITLE } from "@/lib/moved-copy";

export const metadata: Metadata = { title: "How to install · Keepup" };
export const dynamic = "force-static";

const STEPS: { heading: string; steps: string[] }[] = [
  {
    heading: "iPhone and iPad",
    steps: [
      "Open Keepup in Safari.",
      "Tap Share, then Add to Home Screen.",
      "Open Keepup from the new icon and sign in.",
      "Profile → Settings → Turn on reminders.",
      "Had the old icon? Press and hold it and remove it.",
    ],
  },
  {
    heading: "Android",
    steps: [
      "Open Keepup in Chrome.",
      "Tap ⋮, then Install app (or Add to Home screen).",
      "Open Keepup from the new icon, then turn reminders on in Profile → Settings.",
    ],
  },
  {
    heading: "Computer",
    steps: ["In Chrome or Edge, click the install icon at the right of the address bar.", "Then turn reminders on in Profile → Settings."],
  },
];

// Public (lib/paths.ts): linked from Profile and from the "moved" notice (components/moved), and
// saved by the service worker so it opens offline. The README's "How to install" says the same.
export default function InstallPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Keepup
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{INSTALL_TITLE}</h1>
      <p className="mt-2 text-muted-foreground">{INSTALL_INTRO}</p>
      {STEPS.map(({ heading, steps }) => (
        <section key={heading} className="mt-6">
          <h2 className="text-lg font-bold">{heading}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
      <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">{INSTALL_REMINDERS}</p>
    </main>
  );
}
