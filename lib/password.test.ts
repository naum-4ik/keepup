import { describe, expect, it } from "vitest";
import { CONFIRM_EMAIL_SENT, PASSWORD_MIN, credentialsError, passwordAuthMessage } from "./password";

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
