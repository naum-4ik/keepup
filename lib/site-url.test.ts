import { describe, expect, it } from "vitest";
import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("production always shares keepuphabits, whatever domain Vercel reports", () => {
    expect(siteUrl({ deployEnv: "production", vercelProductionUrl: "keepup-murex.vercel.app" })).toBe("https://keepuphabits.vercel.app");
  });
  it("tolerates stray spaces in the environment name", () => {
    expect(siteUrl({ deployEnv: " production ", vercelProductionUrl: "x.vercel.app" })).toBe("https://keepuphabits.vercel.app");
  });
  it("staging and previews use Vercel's production address", () => {
    expect(siteUrl({ deployEnv: "staging", vercelProductionUrl: "keepup-stage.vercel.app" })).toBe("https://keepup-stage.vercel.app");
  });
  it("locally falls back to localhost", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});
