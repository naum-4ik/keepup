import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// The spacing tokens merge like Tailwind's own scale: the later class wins.
describe("cn with the spacing levels", () => {
  it.each([
    ["gap-1.5", "gap-inner", "gap-inner"],
    ["gap-inner", "gap-item", "gap-item"],
    ["p-4", "p-item", "p-item"],
    ["px-4", "px-inner", "px-inner"],
    ["py-2", "py-section", "py-section"],
    ["my-6", "my-section", "my-section"],
    ["-my-2", "-my-inner", "-my-inner"],
    ["space-y-2", "space-y-item", "space-y-item"],
  ])("%s then %s → %s", (a, b, out) => {
    expect(cn(a, b)).toBe(out);
  });

  it("keeps different sides apart", () => {
    expect(cn("px-item", "py-inner")).toBe("px-item py-inner");
  });

  it("still merges the default scale", () => {
    expect(cn("gap-2", "gap-4")).toBe("gap-4");
  });
});
