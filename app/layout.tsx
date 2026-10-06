import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorker } from "@/components/pwa/service-worker";
import "./globals.css";

// Self-hosted (no build-time fetch from Google): the exact latin files next/font/google served,
// Nunito's variable file once per weight we use, as before. Licences: app/fonts/*-OFL.txt.
const nunito = localFont({
  variable: "--font-nunito",
  src: [
    { path: "./fonts/nunito-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/nunito-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/nunito-latin.woff2", weight: "700", style: "normal" },
    { path: "./fonts/nunito-latin.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "./fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Keepup",
  description: "Habits, together.",
  applicationName: "Keepup",
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
        {children}
        <ServiceWorker version={process.env.APP_COMMIT_SHA || "dev"} />
      </body>
    </html>
  );
}
