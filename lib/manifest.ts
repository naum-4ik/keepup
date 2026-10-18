import type { MetadataRoute } from "next";
import en from "@/supabase/functions/_shared/messages/en.json";

// The installed app (ideas/installable-app.md, ideas/app-icon.md). Opens on Today; signed-out people
// land on /login from there. English on purpose: a static file (reading the visitor's language would
// make it per request), browsers fetch it without cookies, and an installed app keeps the copy it saw.
export function webManifest(): MetadataRoute.Manifest {
  return {
    name: "Keepup",
    short_name: "Keepup",
    description: en.common.tagline,
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#FFF8F0",
    background_color: "#FFF8F0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
