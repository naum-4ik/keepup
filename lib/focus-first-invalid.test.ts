import { describe, expect, it, vi } from "vitest";
import { focusFirstInvalid, INVALID_SELECTOR } from "@/lib/focus-first-invalid";

// A tiny element: answers `matches` by its own kind, `querySelector` with the first child it lists.
type Fake = { focus: ReturnType<typeof vi.fn<() => void>>; matches: () => boolean; querySelector: () => Fake | null };
function el(focusable: boolean, child: Fake | null = null): Fake {
  const node: Fake = {
    focus: vi.fn(),
    matches: () => focusable,
    querySelector: () => child,
  };
  return node;
}

describe("focusFirstInvalid", () => {
  it("focuses the first invalid field when it is focusable", () => {
    const input = el(true);
    const root = { querySelector: vi.fn(() => input) };
    expect(focusFirstInvalid(root)).toBe(true);
    expect(root.querySelector).toHaveBeenCalledWith(INVALID_SELECTOR);
    expect(input.focus).toHaveBeenCalled();
  });

  it("focuses the first control inside an invalid group (emoji button, date chips)", () => {
    const button = el(true);
    const group = el(false, button);
    expect(focusFirstInvalid({ querySelector: () => group })).toBe(true);
    expect(button.focus).toHaveBeenCalled();
    expect(group.focus).not.toHaveBeenCalled();
  });

  it("does nothing without an invalid field or a form", () => {
    expect(focusFirstInvalid({ querySelector: () => null })).toBe(false);
    expect(focusFirstInvalid(null)).toBe(false);
    expect(focusFirstInvalid({ querySelector: () => el(false, null) })).toBe(false);
  });
});
