// The /auth/confirm route (app/auth/confirm/route.ts) with a stand-in Supabase client.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }) }));

const { GET } = await import("@/app/auth/confirm/route");

const get = (qs: string) => GET(new NextRequest(`https://keepup.test/auth/confirm?${qs}`));

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset();
});

describe("GET /auth/confirm", () => {
  it.each([
    ["email_change", "/profile/settings"],
    ["invite", "/onboarding"],
    ["recovery", "/auth/new-password"],
    ["email", "/today"],
  ])("verifies a %s token hash and goes to %s", async (type, next) => {
    const res = await get(`token_hash=abc&type=${type}&next=${next}`);
    expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "abc" });
    expect(res.headers.get("location")).toBe(`https://keepup.test${next}`);
  });

  it("ignores an off-site next", async () => {
    const res = await get("token_hash=abc&type=email_change&next=https://evil.test/x");
    expect(new URL(res.headers.get("location")!).origin).toBe("https://keepup.test");
  });

  it("sends an unknown type or a failed verification to the error page", async () => {
    expect((await get("token_hash=abc&type=bogus")).headers.get("location")).toContain("/auth/error?reason=link");
    expect(verifyOtp).not.toHaveBeenCalled();
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    expect((await get("token_hash=abc&type=email_change")).headers.get("location")).toContain("/auth/error?reason=link");
  });
});
