import type { ReactNode } from "react";

// The one empty-list card (Today, Progress, Groups, Inbox): an icon in a soft circle, one line, and
// the next step when there is one.
export function EmptyState({ icon, action, children }: { icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
      <div aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
