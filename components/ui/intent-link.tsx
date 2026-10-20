"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// A link that prefetches its loading screen when you show intent (finger down, pointer over), not when it
// scrolls into view: for long lists (habit cards on Today and Progress), where viewport prefetch would cost a
// server request per row on every visit. prefetch={false} alone would never prefetch (not even on hover, in
// the App Router), so the intent prefetch is ours. The tabs, the bell and group cards keep viewport prefetch.
export function IntentLink({ href, onPointerDown, onMouseEnter, ...rest }: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onPointerDown={(e) => {
        router.prefetch(href);
        onPointerDown?.(e);
      }}
      onMouseEnter={(e) => {
        router.prefetch(href);
        onMouseEnter?.(e);
      }}
    />
  );
}
