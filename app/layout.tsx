import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MovedNotice } from "@/components/moved/moved-notice";
import { Faro } from "@/components/observability/faro";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";
import { siteUrl as siteUrlFor } from "@/lib/site-url";

// Self-hosted (no build-time fetch from Google). Nunito: one variable file (v3.602, the version Google
// serves), subset to Google's latin + latin-ext ranges, so names like Łukasz or Gülşen stay in one font.
// Built from googlefonts/nunito Nunito[wght].ttf with fonttools: pyftsubset --unicodes=<latin,latin-ext>
// --layout-features='*' --flavor=woff2. Geist Mono: Google's latin file. Licences: app/fonts/*-OFL.txt.
const nunito = localFont({
  variable: "--font-nunito",
  src: [{ path: "./fonts/nunito-latin-ext.woff2", weight: "400 800", style: "normal" }],
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "./fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});

// Shared links (LinkedIn, WhatsApp, Slack…) show a card: this title and text, and app/opengraph-image.png.
// The card needs absolute URLs (lib/site-url.ts: production keepuphabits, else Vercel's address).
const siteUrl = siteUrlFor({
  deployEnv: process.env.NEXT_PUBLIC_DEPLOY_ENV,
  vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
const shareText = "A habit tracker for one person or a whole family, kids included.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Keepup",
  description: "Habits, together.",
  applicationName: "Keepup",
  openGraph: { type: "website", siteName: "Keepup", title: "Keepup: Habits, together", description: shareText, url: "/" },
  twitter: { card: "summary_large_image", title: "Keepup: Habits, together", description: shareText },
  // iPhone "Add to Home Screen": full screen, named Keepup (the icon is app/apple-icon.png).
  appleWebApp: { capable: true, title: "Keepup", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#FFF8F0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MovedNotice />
        {children}
        <ServiceWorker version={process.env.APP_COMMIT_SHA || "dev"} />
        <Faro />
      </body>
    </html>
  );
}
