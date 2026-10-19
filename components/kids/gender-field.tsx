"use client";

import { useId } from "react";
import { useT } from "@/lib/i18n/client";
import type { KidGender } from "@/lib/kid-schema";

// Optional boy/girl for the kid's gendered words in Russian and Hebrew. "Not set" posts "" and clears it
// (privacy policy: changeable or clearable at any time); it is the default for a kid with none.
export function GenderField({ defaultValue = null }: { defaultValue?: KidGender | null }) {
  const { t } = useT();
  const hintId = useId();
  return (
    <fieldset aria-describedby={hintId} className="flex flex-col gap-inner">
      <legend className="mb-inner text-sm font-semibold">{t("kids.gender.label")}</legend>
      <div className="flex flex-wrap gap-inner">
        {(["boy", "girl", ""] as const).map((g) => (
          <label key={g} className="flex min-h-11 flex-1 cursor-pointer items-center gap-inner rounded-xl bg-muted/60 px-3 text-sm font-semibold has-[:checked]:bg-accent has-[:checked]:ring-2 has-[:checked]:ring-primary">
            <input type="radio" name="gender" value={g} defaultChecked={(defaultValue ?? "") === g} className="size-5 shrink-0 accent-primary" />
            {t(g === "" ? "kids.gender.unset" : `kids.gender.${g}`)}
          </label>
        ))}
      </div>
      <p id={hintId} className="text-sm text-muted-foreground">{t("kids.gender.hint")}</p>
    </fieldset>
  );
}
