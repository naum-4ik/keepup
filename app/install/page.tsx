import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import androidIcon from "@/docs/install/android-3-icon.svg";
import androidInstall from "@/docs/install/android-2-install.svg";
import androidMenu from "@/docs/install/android-1-menu.svg";
import computerInstall from "@/docs/install/computer-install.svg";
import iphoneAdd from "@/docs/install/iphone-2-add.svg";
import iphoneConfirm from "@/docs/install/iphone-3-confirm.svg";
import iphoneIcon from "@/docs/install/iphone-4-icon.svg";
import iphoneShare from "@/docs/install/iphone-1-share.svg";
import { INSTALL_INTRO, INSTALL_REMINDERS, INSTALL_TITLE } from "@/lib/moved-copy";

export const metadata: Metadata = { title: "How to install · Keepup" };
export const dynamic = "force-static";

type Picture = { src: StaticImageData; alt: string };

// The drawings live in docs/install/ (one source for this page and the README). Imported, they are
// served from /_next/static/, which the service worker keeps, so they show offline too.
const SECTIONS: { heading: string; steps: string[]; pictures: Picture[] }[] = [
  {
    heading: "iPhone and iPad",
    steps: [
      "Open Keepup in Safari.",
      "Tap Share (or ⋯, then Share).",
      "Tap Add to Home Screen.",
      "Check the name is Keepup, then tap Add.",
      "Open Keepup from the new icon and sign in.",
      "Profile → Settings → Turn on reminders.",
      "Had the old icon? Press and hold it and remove it.",
    ],
    pictures: [
      { src: iphoneShare, alt: "Step 1: in Safari, tap the Share button in the toolbar, or ⋯ and then Share" },
      { src: iphoneAdd, alt: "Step 2: in the share sheet, tap Add to Home Screen" },
      { src: iphoneConfirm, alt: "Step 3: the Keepup icon and name, with Add at the top right" },
      { src: iphoneIcon, alt: "Step 4: the Keepup icon on the Home Screen" },
    ],
  },
  {
    heading: "Android",
    steps: [
      "Open Keepup in Chrome.",
      "Tap ⋮, then Install app (or Add to Home screen).",
      "Open Keepup from the new icon, then turn reminders on in Profile → Settings.",
    ],
    pictures: [
      { src: androidMenu, alt: "Step 1: in Chrome, tap the ⋮ menu at the right of the address bar" },
      { src: androidInstall, alt: "Step 2: in the menu, tap Install app" },
      { src: androidIcon, alt: "Step 3: the Keepup icon on the home screen" },
    ],
  },
  {
    heading: "Computer",
    steps: [
      "In Chrome or Edge, click the install icon at the right of the address bar, then Install.",
      "Then turn reminders on in Profile → Settings.",
    ],
    pictures: [{ src: computerInstall, alt: "The install icon at the right of the address bar, and Install Keepup with an Install button" }],
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
      {SECTIONS.map(({ heading, steps, pictures }) => (
        <section key={heading} className="mt-6">
          <h2 className="text-lg font-bold">{heading}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {pictures.map(({ src, alt }) => (
              <Image key={src.src} src={src} alt={alt} className="h-auto w-full" />
            ))}
          </div>
        </section>
      ))}
      <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">{INSTALL_REMINDERS}</p>
    </main>
  );
}
