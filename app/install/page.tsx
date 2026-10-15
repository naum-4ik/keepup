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
import { getT } from "@/lib/i18n/server";

// Renders in the visitor's language (no force-static). The service worker keeps a copy (SHELL_PAGES in
// public/sw.js): offline, that copy is in the last language this device saw.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("meta.pageTitle", { page: t("profile.footer.install") }) };
}

type Section = "iphone" | "android" | "computer";

// The drawings live in docs/install/ (one source for this page and the README). Imported, they are
// served from /_next/static/, which the service worker keeps, so they show offline too. Words: install.<section>.*.
const SECTIONS: { key: Section; steps: number; pictures: StaticImageData[] }[] = [
  { key: "iphone", steps: 7, pictures: [iphoneShare, iphoneAdd, iphoneConfirm, iphoneIcon] },
  { key: "android", steps: 3, pictures: [androidMenu, androidInstall, androidIcon] },
  { key: "computer", steps: 2, pictures: [computerInstall] },
];
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Public (lib/paths.ts): linked from Profile and from the "moved" notice (components/moved), and
// saved by the service worker so it opens offline. The README's "How to install" says the same.
// "Keepup" in the back link is the app's name: not translated.
export default async function InstallPage() {
  const { t } = await getT();
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Keepup
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("moved.installTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("moved.installIntro")}</p>
      {SECTIONS.map(({ key, steps, pictures }) => (
        <section key={key} className="mt-6">
          <h2 className="text-lg font-bold">{t(`install.${key}.heading`)}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {upTo(steps).map((n) => (
              <li key={n}>{t(`install.${key}.step${n}`)}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {pictures.map((src, i) => (
              <Image key={src.src} src={src} alt={t(`install.${key}.pic${i + 1}`)} className="h-auto w-full" />
            ))}
          </div>
        </section>
      ))}
      <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">{t("moved.installReminders")}</p>
    </main>
  );
}
