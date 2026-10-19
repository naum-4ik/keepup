import { focusIsLost } from "@/lib/toast";

// After Undo from Today's toast (lib/check-in-undo.ts onUndone): focus goes back to the habit's
// check-in button. The page shows it open again only once the refresh has committed (until then it
// is the disabled "Done" button, or a remounted one), so this waits for an enabled button with the
// habit's data-check-in, for at most `timeoutMs`. Only while focus is lost (lib/toast.ts focusIsLost):
// once the person moved it themselves, it stays there.
export function focusCheckInWhenOpen(habitId: string, timeoutMs = 3000): void {
  const until = Date.now() + timeoutMs;
  const tick = () => {
    if (!focusIsLost(document.activeElement, document.body)) return;
    const el = document.querySelector<HTMLButtonElement>(`button[data-check-in="${CSS.escape(habitId)}"]`);
    if (el && !el.disabled) return el.focus();
    if (Date.now() < until) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
