import { describe, expect, it } from "vitest";
import { describedBy } from "@/lib/field-error";

describe("describedBy", () => {
  it("joins the ids that apply, in order", () => {
    expect(describedBy("name-help", "name-error")).toBe("name-help name-error");
    expect(describedBy("name-help", false, "name-error")).toBe("name-help name-error");
  });

  it("leaves out the ones that don't apply", () => {
    expect(describedBy("name-help", false)).toBe("name-help");
    expect(describedBy(null, undefined, "name-error")).toBe("name-error");
  });

  it("is nothing at all when none apply, so the attribute is left off", () => {
    expect(describedBy()).toBeUndefined();
    expect(describedBy(false, null, undefined, "")).toBeUndefined();
  });
});
