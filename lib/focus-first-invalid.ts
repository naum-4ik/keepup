// After a submit the server refused field by field: focus goes to the first field it named, in the
// form's own order (docs/design.md "States and feedback": inline errors, focus on the first one).
// A field marks itself with aria-invalid="true" (inputs, selects) or data-invalid (a control group
// such as the emoji button or the date chips, where aria-invalid isn't allowed): the group's first
// focusable element takes focus. Typed structurally so it is unit-tested without a DOM.
export const INVALID_SELECTOR = '[aria-invalid="true"], [data-invalid]';
const FOCUSABLE = "input:not([type=hidden]), select, textarea, button, [tabindex]";

type El = { matches(selector: string): boolean; querySelector(selector: string): El | null; focus(): void };

export function focusFirstInvalid(root: Pick<El, "querySelector"> | null): boolean {
  const field = root?.querySelector(INVALID_SELECTOR);
  if (!field) return false;
  const target = field.matches(FOCUSABLE) ? field : field.querySelector(FOCUSABLE);
  target?.focus();
  return Boolean(target);
}
