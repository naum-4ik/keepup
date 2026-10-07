import { describe, expect, it } from "vitest";
import { REDACTED, redactDeep, redactString } from "./redact";
import { screenName } from "./screen-name";

describe("redact: secrets in any string, server or browser", () => {
  it("masks an invite link's token, the sign-in code and token hashes, and keeps the rest", () => {
    expect(redactString("https://keepup.app/invite/Ab3dEf9?from=share")).toBe(`https://keepup.app/invite/${REDACTED}?from=share`);
    expect(redactString("/auth/callback?code=pkce-secret&next=/today")).toBe(`/auth/callback?code=${REDACTED}&next=/today`);
    expect(redactString("/auth/confirm?token_hash=abc&type=recovery")).toBe(`/auth/confirm?token_hash=${REDACTED}&type=recovery`);
  });

  it("cleans every string in a browser telemetry item, however deep", () => {
    const item = { meta: { page: { url: "https://keepup.app/auth/callback?code=pkce-secret" }, user: { email: "anna@example.com" } }, payload: { values: [1, "token=t0k"] } };
    expect(redactDeep(item)).toEqual({
      meta: { page: { url: `https://keepup.app/auth/callback?code=${REDACTED}` }, user: { email: "anna@example.com" } },
      payload: { values: [1, "token=t0k"] },
    });
    expect(JSON.stringify(redactDeep({ e: "?token=t0k&x=1" }))).not.toContain("t0k");
  });
});

describe("screenName: one name per screen, whatever the ids", () => {
  it("folds ids and invite tokens into the route", () => {
    expect(screenName("/today")).toBe("/today");
    expect(screenName("/habits/6f1c0d3e-0000-4000-8000-000000000001")).toBe("/habits/[id]");
    expect(screenName("/kids/6f1c0d3e-0000-4000-8000-000000000001/play")).toBe("/kids/[id]/play");
    expect(screenName("/invite/Ab3dEf9")).toBe("/invite/[token]");
  });
});
