// Settings → Your data: Export my data and Delete account (M6). The words live in the catalog
// (`myData.*`): the delete word, title, body, hints, and the failed-delete line (a reload brings back
// the check-in queue and push) and the note on the landing page right after a delete (?deleted=1).
import { deviceTimeZone, todayIn } from "@/lib/dates";
import type { ReactNode } from "react";
import { listNodes, type Rich } from "@/lib/list-nodes";
import { type Locale, type T } from "@/supabase/functions/_shared/i18n";

export type DeletePreview = {
  groups_deleted: { name: string; children: string[] }[];
  admin_handover: { group: string; new_admin: string }[];
};

// The word in the person's language, or the English one (a keyboard may not have the other).
export function isDeleteWord(t: T, typed: string): boolean {
  const word = typed.trim().toLowerCase();
  return word === t("myData.deleteWord").toLowerCase() || word === "delete";
}

// The person's own date (the browser's time zone), not UTC's: a late-evening export isn't dated tomorrow.
export function myDataFileName(now: Date, timeZone = deviceTimeZone()): string {
  return `keepup-my-data-${todayIn(timeZone, now)}.json`;
}

export function deletePreviewLines(rich: Rich, locale: Locale, p: DeletePreview): ReactNode[] {
  return [
    ...p.groups_deleted.map((g) =>
      g.children.length === 0
        ? rich("myData.groupDeleted", { group: g.name })
        : rich("myData.groupDeletedWithProfiles", {
            group: g.name,
            n: g.children.length,
            names: listNodes(locale, g.children, (c) => rich("myData.possessive", { name: c })),
          }),
    ),
    ...p.admin_handover.map((h) => rich("myData.becomesAdmin", { admin: h.new_admin, group: h.group })),
  ];
}

// The confirm button's steps (components/profile/my-data.tsx). Online, waiting check-ins are sent
// first (as at sign-out), so only taps that couldn't be sent anyway are lost. Then the phone is
// cleared, before the delete, because a successful delete redirects and nothing runs after it.
// remove resolves only on failure; its redirect reaches here as a rejection (Next 16), which
// `rethrow` (next/navigation's unstable_rethrow) passes on. Returns the error to show, if any.
export async function runDelete(t: T, steps: {
  flush: () => Promise<void>;
  clearPhone: () => Promise<void>;
  remove: () => Promise<{ ok: false; message: string } | undefined>;
  rethrow: (e: unknown) => void;
}): Promise<string | null> {
  try {
    await steps.flush();
  } catch (e) {
    console.error("delete account: sending waiting check-ins", e);
  }
  try {
    await steps.clearPhone();
    const r = await steps.remove();
    return r && !r.ok ? t("myData.deleteFailed") : null;
  } catch (e) {
    steps.rethrow(e);
    console.error("delete account", e);
    // The phone may be cleared already: a reload brings the queue and push back.
    return t("myData.deleteFailed");
  }
}
