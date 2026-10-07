import { describe, expect, it } from "vitest";
import { BANNED_PATTERNS, BANNED_WORDS } from "./notification-copy";
import { CONFIRM_EMAIL_SENT, PASSWORD_MIN, RESET_LINK_SENT, RESET_LINK_STALE, credentialsError, isFreshRecovery, newPasswordError, passwordAuthMessage } from "./password";

describe("credentialsError", () => {
  it("accepts a valid email and a long enough password", () => {
    expect(credentialsError("ana@example.com", "x".repeat(PASSWORD_MIN), "signup")).toBeNull();
    expect(credentialsError("ana@example.com", "short", "signin")).toBeNull(); // sign-in checks only that it's there
  });

  it("asks for a valid email first", () => {
    expect(credentialsError("ana@", "whatever-long", "signin")).toEqual({ field: "email", message: "Enter a valid email address." });
  });

  it("asks for at least 8 characters on sign-up, counting characters not bytes", () => {
    expect(credentialsError("ana@example.com", "1234567", "signup")).toEqual({ field: "password", message: "Use at least 8 characters." });
    expect(credentialsError("ana@example.com", "😀".repeat(8), "signup")).toBeNull();
  });

  it("asks for a password on sign-in", () => {
    expect(credentialsError("ana@example.com", "", "signin")).toEqual({ field: "password", message: "Enter your password." });
  });
});

describe("newPasswordError", () => {
  it("asks for at least 8 characters, the same as sign-up", () => {
    expect(newPasswordError("1234567")).toBe("Use at least 8 characters.");
    expect(newPasswordError("😀".repeat(8))).toBeNull();
  });
});

describe("RESET_LINK_SENT", () => {
  it("never says whether the account exists, and stays calm", () => {
    expect(RESET_LINK_SENT).toBe("If that email has an account, a reset link is on its way.");
    for (const text of [RESET_LINK_SENT, RESET_LINK_STALE, passwordAuthMessage({ code: "same_password" })]) {
      for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
      for (const re of BANNED_PATTERNS) expect(text).not.toMatch(re);
    }
  });
});

describe("CONFIRM_EMAIL_SENT", () => {
  it("tells the person what to do next", () => {
    expect(CONFIRM_EMAIL_SENT).toBe("Almost done: open the link we emailed you to confirm your address, then sign in.");
  });
});

describe("passwordAuthMessage", () => {
  it.each([
    ["invalid_credentials", "That email and password don't match. Try again."],
    ["user_already_exists", "That email already has an account."],
    ["email_exists", "That email already has an account."],
    ["weak_password", "Use at least 8 characters."],
    ["over_request_rate_limit", "Too many tries. Wait a minute and try again."],
    ["email_address_invalid", "Enter a valid email address."],
    ["email_not_confirmed", "Confirm your email first: open the link we sent you, then sign in."],
  ])("maps %s", (code, message) => {
    expect(passwordAuthMessage({ code })).toBe(message);
  });

  it("falls back to a generic message", () => {
    expect(passwordAuthMessage({ code: "unexpected_failure" })).toBe("Something went wrong. Try again.");
    expect(passwordAuthMessage({})).toBe("Something went wrong. Try again.");
  });
});

describe("isFreshRecovery", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const at = (minutesAgo: number) => now.getTime() / 1000 - minutesAgo * 60;

  it("accepts a reset link opened in the last 15 minutes, by either path", () => {
    expect(isFreshRecovery({ amr: [{ method: "recovery", timestamp: at(1) }] }, now)).toBe(true); // PKCE code
    expect(isFreshRecovery({ amr: [{ method: "otp", timestamp: at(14) }] }, now)).toBe(true); // token_hash
  });

  it("refuses a stale reset link", () => {
    expect(isFreshRecovery({ amr: [{ method: "recovery", timestamp: at(16) }] }, now)).toBe(false);
    expect(isFreshRecovery({ amr: [{ method: "otp", timestamp: at(60) }] }, now)).toBe(false);
  });

  it("refuses a normal password or Google session, however fresh", () => {
    expect(isFreshRecovery({ amr: [{ method: "password", timestamp: at(0) }] }, now)).toBe(false);
    expect(isFreshRecovery({ amr: [{ method: "oauth", timestamp: at(0) }] }, now)).toBe(false);
  });

  it("refuses an anonymous demo session and missing claims", () => {
    expect(isFreshRecovery({ amr: [{ method: "anonymous", timestamp: at(0) }], is_anonymous: true }, now)).toBe(false);
    expect(isFreshRecovery({ amr: [{ method: "otp", timestamp: at(0) }], is_anonymous: true }, now)).toBe(false);
    expect(isFreshRecovery({}, now)).toBe(false);
    expect(isFreshRecovery(null, now)).toBe(false);
  });
});
