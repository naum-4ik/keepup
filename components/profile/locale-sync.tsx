"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncLocale } from "@/app/(app)/profile/settings/actions";
import type { Locale } from "@/i18n/config";

// Cookies can't be set while rendering (cookies.md): the layout renders this when the profile and the
// device cookie disagree, and the server action brings them in line once. The next render is in sync,
// so this doesn't render again. refresh: only when the page's language changes.
export function LocaleSync({ save, cookie, refresh }: { save: Locale | null; cookie: Locale | null; refresh: boolean }) {
  const router = useRouter();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    syncLocale(save, cookie)
      .then((r) => {
        if (!r.ok || !refresh) return;
        navigator.serviceWorker?.controller?.postMessage({ type: "keepup:clear-pages" });
        router.refresh();
      })
      .catch(() => {});
  }, [save, cookie, refresh, router]);
  return null;
}
