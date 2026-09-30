import { describe, expect, it } from "vitest";
import { errorCode, GENERIC_ERROR, habitErrorMessage } from "./habit-errors";

describe("habitErrorMessage", () => {
  it("maps database rule errors to friendly copy", () => {
    expect(habitErrorMessage({ message: "keepup:already_checked_in_today" })).toBe("Already checked in today. Come back tomorrow.");
    expect(habitErrorMessage({ message: "keepup:freeze_in_past" })).toBe("A pause can't start in the past.");
    expect(habitErrorMessage({ message: "keepup:start_locked" })).toBe("The start date can't change after the first check-in.");
  });

  it("maps group errors", () => {
    expect(habitErrorMessage({ message: "keepup:last_admin" })).toBe("Make someone else an admin first.");
    expect(habitErrorMessage({ message: "keepup:invite_invalid" })).toMatch(/expired/);
  });

  it("falls back to a generic message", () => {
    expect(habitErrorMessage({ message: "connection reset" })).toBe(GENERIC_ERROR);
    expect(habitErrorMessage(null)).toBe(GENERIC_ERROR);
  });
});

describe("errorCode", () => {
  it("reads the keepup: code from a database error", () => {
    expect(errorCode({ message: "keepup:children_would_be_deleted" })).toBe("children_would_be_deleted");
    expect(errorCode({ message: "ERROR: keepup:last_admin (P0001)" })).toBe("last_admin");
  });
  it("is undefined when there is no code", () => {
    expect(errorCode({ message: "connection reset" })).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode({})).toBeUndefined();
  });
});
