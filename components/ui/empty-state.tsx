import type { ReactNode } from "react";

// An empty list (docs/design.md "Empty states"): an icon in a soft circle, one line that says what
// fills this place, and the action that fills it. No card (nothing here to pick or open). The action
// is required: an empty state always says what to do next.
export function EmptyState({ icon, action, children }: { icon: ReactNode; action: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-item py-section text-center">
      <div aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        {icon}
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
