"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { setChildTheme } from "@/app/(app)/kids/actions";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { KID_THEMES, themeName } from "@/lib/garden";
import { useT } from "@/lib/i18n/client";
import { reach } from "@/lib/reach";
import { cn } from "@/lib/utils";
import { isolate } from "@/supabase/functions/_shared/i18n";

// ideas/kid-view-next.md §2: what grows as the stars come in. Big picture tiles to choose together:
// three a row at every width (five a row broke "Garde/n" at 320), each at least 44 px wide, the names
// wrapping only between words (wrap-normal break-normal undo the page's wrap-anywhere).
// The picked tile shows at once; while it saves a line says so; then a toast with the kid view a tap
// away (that's where the change shows); a failure puts the saved theme back and says what to do.
export function ThemePicker({ childId, childName, theme }: { childId: string; childName: string; theme: string }) {
  const { t: tr } = useT();
  const t = useTranslations("kids.theme");
  const tk = useTranslations("kids");
  const { showToast } = useToast();
  const [current, setCurrent] = useState(theme);
  const [saving, setSaving] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (id: string) => {
    if (id === current) return;
    const before = current;
    setCurrent(id);
    setSaving(id);
    setError(null);
    startTransition(async () => {
      const r = await reach(() => setChildTheme(childId, id), { offline: tk("errors.offline"), reload: tk("errors.reload") });
      setSaving(null);
      if (!r.ok) {
        setCurrent(before);
        setError(r.message);
        return;
      }
      showToast({
        text: t("changed", { theme: themeName(tr, id) }),
        action: { label: tk("detail.openView", { name: isolate(childName) }), href: `/kids/${childId}/play` },
      });
    });
  };

  return (
    <Section title={t("title")}>
      {/* The heading's hint: 8 px under it (inner level), not the section's 16. */}
      <p className="-mt-inner text-sm text-muted-foreground">{t.rich("hint", { name: childName, bdi: (c) => <bdi>{c}</bdi> })}</p>
      <div role="group" aria-label={t("group")} className="grid grid-cols-3 gap-inner">
        {KID_THEMES.map((th) => (
          <button
            key={th.id}
            type="button"
            aria-pressed={current === th.id}
            disabled={pending}
            onClick={() => choose(th.id)}
            className={cn(
              // p-inner and a 2 px border: the name has the tile's width less 20 px (about 70 px at 320).
              "relative flex min-h-20 min-w-11 flex-col items-center justify-center gap-inner rounded-2xl border-2 border-transparent bg-muted/50 p-inner text-center text-xs leading-tight font-semibold wrap-normal break-normal hover:bg-muted",
              "aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground",
            )}
          >
            <span aria-hidden className="text-3xl leading-none">{th.icon}</span>
            {themeName(tr, th.id)}
            {/* The picked one also carries a ✓, so it isn't told by colour alone. 4 px in from the corner. */}
            {current === th.id && (
              <span aria-hidden className="absolute top-1 end-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      <p role="status" className={cn("text-sm text-muted-foreground", !saving && "sr-only")}>
        {saving ? t("changing", { theme: themeName(tr, saving) }) : ""}
      </p>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </Section>
  );
}
