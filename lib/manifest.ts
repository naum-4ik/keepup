import type { MetadataRoute } from "next";

// The installed app (ideas/installable-app.md, ideas/app-icon.md). Opens on Today; signed-out people
// land on /login from there.
export function webManifest(): MetadataRoute.Manifest {
  return {
    name: "Keepup",
    short_name: "Keepup",
    description: "Habits, together.",
    id: "/today",
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
