import { tEn } from "@/lib/i18n/test-t";
import { describe, expect, it } from "vitest";
import { habitErrorMessage } from "./habit-errors";

describe("notification setting errors", () => {
  it("speak plainly", () => {
    expect(habitErrorMessage(tEn, { message: "keepup:invalid_category" })).toBe("That setting isn't available.");
    expect(habitErrorMessage(tEn, { message: "keepup:invalid_choice" })).toBe("Pick one of the options.");
    expect(habitErrorMessage(tEn, { message: "keepup:invalid_subscription" })).toBe("This device couldn't be set up for notifications.");
    expect(habitErrorMessage(tEn, { message: "keepup:invalid_time" })).toBe("Pick a time on the quarter hour.");
  });
});
