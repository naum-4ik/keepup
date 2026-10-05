// One look for every "add" action that isn't a page's main call to action (empty states keep their
// filled button): a dashed outline, 44px tall, with a ＋ icon (`<Plus aria-hidden className="size-4" />`).
// For Links and buttons alike.
export const addButtonClass =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 text-sm font-bold text-primary hover:bg-accent";
