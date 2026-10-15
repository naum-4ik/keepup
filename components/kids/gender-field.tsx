"use client";

import { useT } from "@/lib/i18n/client";
import type { KidGender } from "@/lib/kid-schema";

// Optional boy/girl for the kid's gendered words in Russian and Hebrew. Nothing is preselected for a new
// kid; a radio can't be unset, so the form only ever sets it.
export function GenderField({ defaultValue = null }: { defaultValue?: KidGender | null }) {
  const { t } = useT();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{t("kids.gender.label")}</legend>
      <div className="flex gap-2">
        {(["boy", "girl"] as const).map((g) => (
          <label key={g} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl bg-muted/60 px-3 text-sm font-semibold has-[:checked]:bg-accent has-[:checked]:ring-2 has-[:checked]:ring-primary">
            <input type="radio" name="gender" value={g} defaultChecked={defaultValue === g} className="size-5 shrink-0 accent-primary" />
            {t(`kids.gender.${g}`)}
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t("kids.gender.hint")}</p>
    </fieldset>
  );
}
