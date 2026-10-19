import { describe, expect, it } from "vitest";
import { alreadyReviewedNote, ERROR_CODES, errorCode, habitErrorMessage, reviewerOf } from "./habit-errors";
import { tEn } from "@/lib/i18n/test-t";
import en from "@/supabase/functions/_shared/messages/en.json";

const GENERIC_ERROR = "That didn't go through. Try again; if it keeps happening, reload the page.";

describe("habitErrorMessage", () => {
  it("maps database rule errors to friendly copy", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:already_checked_in_today" })).toBe("Already checked in today. Come back tomorrow.");
    expect(habitErrorMessage(tEn, { message: "keepup:freeze_in_past" })).toBe("A pause can't start in the past.");
    expect(habitErrorMessage(tEn, { message: "keepup:start_locked" })).toBe("The start date can't change after the first check-in.");
    expect(habitErrorMessage(tEn, { message: "keepup:end_too_early" })).toBe("The end can move later or be removed, not earlier.");
    expect(habitErrorMessage(tEn, { message: "keepup:habit_ended" })).toBe("This habit has ended. Keep going or finish it from Today.");
  });

  it("maps group errors", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:last_admin" })).toBe("Make someone else an admin first.");
    expect(habitErrorMessage(tEn, { message: "keepup:invite_invalid" })).toMatch(/expired/);
  });

  it("asks for a child's nickname", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:invalid_name", code: "22023" })).toBe("Enter a nickname.");
  });

  it("says what's off in the demo", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:demo" })).toBe("That's off in the demo.");
  });

  it("maps end and range rules", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:end_passed" })).toMatch(/has ended, so its end can't change/);
    expect(habitErrorMessage(tEn, { message: "keepup:bad_range" })).toBe("Pick a valid date range (up to two months).");
    expect(
      habitErrorMessage(tEn, { code: "23514", message: 'new row for relation "habits" violates check constraint "habits_ends_after_start_check"' }),
    ).toBe("The last day can't be before the first day.");
    expect(habitErrorMessage(tEn, { code: "23514", message: 'violates check constraint "something_else"' })).toBe(GENERIC_ERROR);
  });

  it("falls back to a generic message", () => {
    expect(habitErrorMessage(tEn, { message: "connection reset" })).toBe(GENERIC_ERROR);
    expect(habitErrorMessage(tEn, null)).toBe(GENERIC_ERROR);
  });
});

describe("the catalog", () => {
  it("has a message for every database rule the app names, and no others", () => {
    const keys = Object.keys(en.errors).filter((k) => /^[a-z_]+$/.test(k) && k !== "generic");
    expect([...ERROR_CODES].sort()).toEqual(keys.sort());
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

describe("already reviewed by X", () => {
  it("reads the reviewer's name from the error's details", () => {
    const error = { message: "keepup:already_reviewed", details: "Dan" };
    expect(reviewerOf(error)).toBe("Dan");
    expect(alreadyReviewedNote(tEn, reviewerOf(error))).toBe("\u2068Dan\u2069 already reviewed this.");
  });

  it("falls back to the current copy without a name", () => {
    expect(reviewerOf({ message: "keepup:already_reviewed" })).toBeUndefined();
    expect(reviewerOf({ message: "keepup:already_reviewed", details: "  " })).toBeUndefined();
    expect(alreadyReviewedNote(tEn, reviewerOf({ message: "keepup:already_reviewed", details: null }))).toBe("Someone already reviewed this.");
  });

  it("ignores details on other errors", () => {
    expect(reviewerOf({ message: "keepup:review_closed", details: "Dan" })).toBeUndefined();
  });
});
