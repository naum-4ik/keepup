// lib/ios-splash.test.ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import screens from "./ios-splash.json";
import { iosStartupImages, splashFile, splashMedia } from "./ios-splash";

describe("iPhone launch screens", () => {
  it("names each picture by its pixel size", () => {
    expect(splashFile({ width: 390, height: 844, ratio: 3 })).toBe("/splash/iphone-1170x2532.png");
  });
  it("matches the exact screen, in points and pixel ratio, portrait only", () => {
    expect(splashMedia({ width: 414, height: 896, ratio: 2 })).toBe(
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    );
  });
  it("lists every screen once, and each picture is in public/", () => {
    const images = iosStartupImages();
    expect(new Set(images.map((i) => i.media)).size).toBe(screens.length);
    for (const { url } of images) expect(existsSync(path.join(process.cwd(), "public", url)), url).toBe(true);
  });
});
