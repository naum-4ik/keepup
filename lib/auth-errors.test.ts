import { describe, expect, it } from "vitest";
import { authErrorReason } from "./auth-errors";

describe("authErrorReason", () => {
  it("returns null when there is no error", () => {
    expect(authErrorReason(new URLSearchParams())).toBeNull();
    expect(authErrorReason({})).toBeNull();
  });

  it.each(["otp_expired", "flow_state_expired"])("treats error_code=%s as expired", (code) => {
    expect(authErrorReason(new URLSearchParams({ error: "access_denied", error_code: code }))).toBe(
      "expired",
    );
    expect(authErrorReason({ error: "access_denied", error_code: code })).toBe("expired");
  });

  it("treats access_denied without a known code as denied", () => {
    expect(authErrorReason(new URLSearchParams({ error: "access_denied" }))).toBe("denied");
    expect(authErrorReason({ error: "access_denied" })).toBe("denied");
  });

  it("treats other errors as unknown", () => {
    expect(authErrorReason(new URLSearchParams({ error: "server_error" }))).toBe("unknown");
    expect(
      authErrorReason(new URLSearchParams({ error: "access_denied", error_code: "some_other_code" })),
    ).toBe("unknown");
    expect(authErrorReason({ error_code: "weird_code" })).toBe("unknown");
  });
});
