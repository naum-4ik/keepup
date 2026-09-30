import { describe, expect, it } from "vitest";
import { errorCode, GENERIC_ERROR, habitErrorMessage } from "./habit-errors";

describe("habitErrorMessage", () => {
  it("maps database rule errors to friendly copy", () => {
    expect(habitErrorMessage({ message: "keepup:already_checked_in_today" })).toBe("Already checked in today. Come back tomorrow.");
    expect(habitErrorMessage({ message: "keepup:freeze_in_past" })).toBe("A pause can't start in the past.");
    expect(habitErrorMessage({ message: "keepup:start_locked" })).toBe("The start date can't change after the first check-in.");
    expect(habitErrorMessage({ message: "keepup:end_too_early" })).toBe("The end can move later or be removed, not earlier.");
    expect(habitErrorMessage({ message: "keepup:habit_ended" })).toBe("This habit has ended. Keep going or finish it from Today.");
  });

  it("maps group errors", () => {
    expect(habitErrorMessage({ message: "keepup:last_admin" })).toBe("Make someone else an admin first.");
    expect(habitErrorMessage({ message: "keepup:invite_invalid" })).toMatch(/expired/);
  });

  it("maps end and range rules", () => {
    expect(habitErrorMessage({ message: "keepup:end_passed" })).toMatch(/has ended, so its end can't change/);
    expect(habitErrorMessage({ message: "keepup:bad_range" })).toBe("Pick a valid date range (up to two months).");
    expect(
      habitErrorMessage({ code: "23514", message: 'new row for relation "habits" violates check constraint "habits_ends_after_start_check"' }),
    ).toBe("The last day can't be before the first day.");
    expect(habitErrorMessage({ code: "23514", message: 'violates check constraint "something_else"' })).toBe(GENERIC_ERROR);
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
