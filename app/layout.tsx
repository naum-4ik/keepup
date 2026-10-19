import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Direction } from "radix-ui"; // Radix reads its own provider, not <html dir>
import { MovedNotice } from "@/components/moved/moved-notice";
import { Faro } from "@/components/observability/faro";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";
import { deploymentSiteUrl } from "@/lib/site-url";
import { isRtl } from "@/supabase/functions/_shared/i18n";
import { CLIENT_NAMESPACES } from "@/i18n/client-namespaces";

// Self-hosted (no build-time fetch from Google). Nunito v3.602 (the version Google serves), split like
// Google's CSS into two variable files: latin (preloaded: every page's text) and latin-ext (names like
// Łukasz or Gülşen; not preloaded, fetched only when a page shows those letters, by unicode-range).
// Built from googlefonts/nunito Nunito[wght].ttf with fonttools: pyftsubset --unicodes=<Google's latin,
// or latin-ext, range below> --layout-features='*' --flavor=woff2. Geist Mono: Google's latin file.
// Licences: app/fonts/*-OFL.txt.
const nunito = localFont({
  variable: "--font-nunito",
  src: [{ path: "./fonts/nunito-latin.woff2", weight: "400 800", style: "normal" }],
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});
const nunitoLatinExt = localFont({
  variable: "--font-nunito-ext",
  src: [{ path: "./fonts/nunito-latin-ext.woff2", weight: "400 800", style: "normal" }],
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    },
  ],
  adjustFontFallback: false, // the Arial fallback face would catch latin-ext letters before this file
});

// Cyrillic (Russian) from the same Nunito family (@fontsource-variable/nunito 5.3.0, nunito-cyrillic-wght-normal.woff2);
// Hebrew from Rubik (@fontsource-variable/rubik 5.3.0, rubik-hebrew-wght-normal.woff2; rounded, close to Nunito):
// Nunito has no Hebrew. Not preloaded; unicode-range (from fontsource) makes the browser fetch them only
// when a page uses those letters.
const nunitoCyrillic = localFont({
  variable: "--font-nunito-cyr",
  src: [{ path: "./fonts/nunito-cyrillic.woff2", weight: "400 800", style: "normal" }],
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
  adjustFontFallback: false, // the Arial fallback face would catch Cyrillic/Hebrew before these files
});
const rubikHebrew = localFont({
  variable: "--font-rubik-he",
  src: [{ path: "./fonts/rubik-hebrew.woff2", weight: "300 900", style: "normal" }],
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F" }],
  adjustFontFallback: false, // the Arial fallback face would catch Cyrillic/Hebrew before these files
});

// Only Profile's version label uses it: not preloaded, so the 23 KB file never competes with the
// landing's first paint (the browser fetches it when a page shows that label).
const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "./fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
  preload: false,
});

// Shared links (LinkedIn, WhatsApp, Slack…) show a card: this title and text, and app/opengraph-image.png.
// The card needs absolute URLs (lib/site-url.ts: production keepuphabits, else Vercel's address).
const siteUrl = deploymentSiteUrl();
// Words in the visitor's language (meta.*, common.tagline); "Keepup" is the name and stays. The image
// (app/opengraph-image.png and its alt text) stays English.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const shareTitle = t("meta.shareTitle");
  const shareText = t("meta.shareText");
  return {
    metadataBase: new URL(siteUrl),
    // Pages without their own title (the app's screens). The landing has its own (app/page.tsx).
    title: "Keepup",
    description: t("common.tagline"),
    applicationName: "Keepup",
    openGraph: { type: "website", siteName: "Keepup", title: shareTitle, description: shareText, url: "/" },
    twitter: { card: "summary_large_image", title: shareTitle, description: shareText },
    // iPhone "Add to Home Screen": full screen, named Keepup (the icon is app/apple-icon.png).
    appleWebApp: { capable: true, title: "Keepup", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#FFF8F0",
};

// Only the namespaces client code reads go to the browser (the full catalog would ride along on every page).
function pick<M extends object, K extends keyof M>(messages: M, keys: readonly K[]): Pick<M, K> {
  return Object.fromEntries(keys.map((k) => [k, messages[k]])) as Pick<M, K>;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = isRtl(locale) ? "rtl" : "ltr";
  // From getMessages(), so other languages keep English underneath (i18n/request.ts).
  const messages = pick(await getMessages(), CLIENT_NAMESPACES);
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${nunito.variable} ${nunitoLatinExt.variable} ${nunitoCyrillic.variable} ${rubikHebrew.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Direction.Provider dir={dir}>
          <NextIntlClientProvider messages={messages}>
            <MovedNotice />
            {children}
            <ServiceWorker version={process.env.APP_COMMIT_SHA || "dev"} />
            <Faro />
          </NextIntlClientProvider>
        </Direction.Provider>
      </body>
    </html>
  );
}
