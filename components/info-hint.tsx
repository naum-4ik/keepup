"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

// A small (i) next to a field label: tap to show one short line, tap again (or Esc) to hide it.
export function InfoHint({ text }: { text: string }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        aria-label={t("whatIsThis")}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="-my-2.5 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Info className="size-4" aria-hidden />
      </button>
      <p id={id} hidden={!open} className="basis-full text-xs text-muted-foreground">
        {text}
      </p>
    </>
  );
}
