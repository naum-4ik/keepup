"use client";

import type { Faro as FaroInstance } from "@grafana/faro-web-sdk";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { redactDeep } from "@/lib/redact";
import { screenName } from "@/lib/screen-name";

// Inlined at build time (NEXT_PUBLIC_*). No collector URL (dev without it, tests, CI): nothing loads.
const COLLECTOR = process.env.NEXT_PUBLIC_FARO_URL;

// Faro and browser tracing are about 65 KB gzipped, so they load after the page is up: first paint never
// waits for telemetry. Web Vitals still count from the start (the browser buffers them); an error thrown
// before the load is missed.
let ready: Promise<FaroInstance | null> | undefined;

function load() {
  ready ??= (async () => {
    if (!COLLECTOR) return null;
    try {
      const [{ getWebInstrumentations, initializeFaro }, { TracingInstrumentation }] = await Promise.all([
        import("@grafana/faro-web-sdk"),
        import("@grafana/faro-web-tracing"),
      ]);
      return initializeFaro({
        url: COLLECTOR,
        app: {
          name: "keepup",
          version: process.env.APP_COMMIT_SHA || "dev",
          environment: process.env.NEXT_PUBLIC_DEPLOY_ENV || "local",
        },
        // The default web instrumentations (errors, console errors and warnings, Web Vitals, sessions,
        // views) and tracing: same-origin requests carry the trace, so a tap's server trace continues it.
        instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
        // The same cleaning as the server's (sign-in code, tokens, invite tokens) on everything sent.
        beforeSend: (item) => redactDeep(item),
      });
    } catch {
      return null; // Telemetry never breaks the app.
    }
  })();
  return ready;
}

// In the root layout: names each screen as the route changes (page views).
export function Faro() {
  const pathname = usePathname();
  useEffect(() => {
    void load().then((faro) => faro?.api.setView({ name: screenName(pathname) }));
  }, [pathname]);
  return null;
}

// In the signed-in layout: who is using the browser, so its errors and screens are per person.
// A demo login is marked, so dashboards can leave it out or count it on its own.
export function FaroUser({ id, email, demo }: { id: string; email?: string; demo: boolean }) {
  useEffect(() => {
    void load().then((faro) => faro?.api.setUser({ id, email, attributes: { demo: String(demo) } }));
  }, [id, email, demo]);
  return null;
}
