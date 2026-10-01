import { describe, expect, it } from "vitest";
import { webManifest } from "./manifest";

describe("web app manifest", () => {
  const m = webManifest();

  it("opens full screen as Keepup on Today", () => {
    expect(m).toMatchObject({ name: "Keepup", short_name: "Keepup", display: "standalone", start_url: "/today", scope: "/", id: "/" });
  });

  it("uses the app-icon colours (ideas/app-icon.md)", () => {
    expect(m.theme_color).toBe("#FFF8F0");
    expect(m.background_color).toBe("#FFF8F0");
  });

  it("has the two sprout icons and the maskable one", () => {
    expect(m.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("is valid JSON", () => {
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
});
