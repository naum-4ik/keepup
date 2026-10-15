// lib/offline-copy.ts
// The offline UI's two sentences with a value in them. The rest of its words are in the catalog
// (offline.*, ideas/offline.md §3). Feed notes live in the shared copy sheet.
import { isolate, type T } from "@/supabase/functions/_shared/i18n";

export const undoLabel = (t: T, habit: string): string => t("offline.undoLabel", { habit: isolate(habit) });

// Sign-out with check-ins still on the phone (lib/push-support.ts signOutWithQueue). `count` is a
// string so a large number isn't grouped by the formatter.
export const unsavedSignOut = (t: T, n: number): string => t("offline.unsavedSignOut", { n, count: String(n) });
