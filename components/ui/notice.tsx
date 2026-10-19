import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "success" | "error";

const tones: Record<NoticeTone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-muted text-muted-foreground", icon: Info },
  success: { box: "bg-done-soft text-done", icon: CircleCheck },
  error: { box: "bg-destructive/10 text-destructive", icon: CircleAlert },
};

// An inline status line (docs/design.md "Notices"): what happened or what to know, in one or two
// lines, with the next step as `action` (a link or a button) and an optional dismiss. Not a card: a
// soft tint, no shadow. Replaces the cards that only held a sentence. 12px side padding, off the
// 8/16/24 scale on purpose: it matches the 12px corner radius (rounded-xl), so text never meets the curve.
// `live`: the line appears after something the person did (an error after a tap), so screen readers
// announce it: errors as alert, the rest as status. Leave it off for a line that is there on load.
export function Notice({
  tone = "info",
  action,
  dismiss,
  live = false,
  className,
  children,
}: {
  tone?: NoticeTone;
  action?: ReactNode;
  // Client components only (a function can't cross from the server). `label`: the X's name.
  dismiss?: { onDismiss: () => void; label: string };
  live?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("flex items-center gap-inner rounded-xl px-3 py-2 text-sm font-semibold", box, className)}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{children}</p>
      {action && <div className="shrink-0">{action}</div>}
      {dismiss && (
        <button
          type="button"
          onClick={dismiss.onDismiss}
          aria-label={dismiss.label}
          className="-my-2 -me-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background/60"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
