// supabase/functions/send-push/handler.ts
// The webhook body: {"id": "<notification id>"}. One push per device; 404/410 = the device is gone.
import { timingSafeEqual } from "node:crypto";
import { buildPush, type PushJob } from "./build.ts";
import { translatorFor } from "./i18n.ts";

export type Subscription = PushJob["subscriptions"][number];
// One row of public.push_deliveries. Only the push service's host, never the endpoint or its keys.
export type Delivery = {
  notification_id: string;
  user_id: string;
  kind: string;
  outcome: "sent" | "gone" | "failed" | "skipped";
  reason: string | null;
  status: number | null;
  endpoint_host: string | null;
};
export type Deps = {
  secret: string;
  // VAPID keys and subject are set (index.ts checks them at startup).
  pushConfigured: boolean;
  loadJob(id: string): Promise<PushJob | null>;
  // Resolves with the push service's HTTP status when it reports one.
  send(sub: Subscription, payload: string): Promise<number | void>;
  done(id: string, deadEndpoints: string[]): Promise<void>;
  log(row: Delivery): Promise<void>;
};

const GONE = new Set([404, 410]);
const statusOf = (e: unknown): number =>
  typeof e === "object" && e !== null && "statusCode" in e ? Number((e as { statusCode: unknown }).statusCode) : 0;

const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

const hostOf = (endpoint: string): string | null => {
  try {
    return new URL(endpoint).host;
  } catch {
    return null;
  }
};

// The delivery log never breaks sending: a JSON line for the function logs first, then the row.
async function record(deps: Deps, row: Delivery): Promise<void> {
  const { notification_id, user_id, kind, outcome, reason, status } = row;
  console.log(JSON.stringify({ event: "push_delivery", notification_id, user_id, kind, outcome, reason, status }));
  try {
    await deps.log(row);
  } catch (e) {
    console.error("push log failed", e instanceof Error ? e.message : String(e));
  }
}

// Constant time: hashing first makes both sides the same length, so length leaks nothing either.
async function secretMatches(given: string | null, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given ?? ""), sha256(expected)]);
  return timingSafeEqual(a, b);
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!deps.secret || !(await secretMatches(req.headers.get("x-keepup-push-secret"), deps.secret))) {
    return new Response("forbidden", { status: 403 });
  }
  // Without VAPID nothing can be sent: fail loudly and leave the row unpushed (no push_done).
  if (!deps.pushConfigured) return Response.json({ error: "push not configured" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const job = await deps.loadJob(id);
  if (!job || job.pushed) return Response.json({ skipped: true });

  const { t, locale } = translatorFor(job.locale);
  const payload = buildPush(job, t, locale);
  const dead: string[] = [];
  let sent = 0;
  const base = { notification_id: job.id, user_id: job.user_id, kind: job.kind };
  if (payload) {
    if (job.subscriptions.length === 0) {
      await record(deps, { ...base, outcome: "skipped", reason: "no_device", status: null, endpoint_host: null });
    }
    const text = JSON.stringify(payload);
    await Promise.all(
      job.subscriptions.map(async (sub) => {
        const endpoint_host = hostOf(sub.endpoint);
        let row: Delivery;
        try {
          const status = await deps.send(sub, text);
          sent++;
          row = { ...base, outcome: "sent", reason: null, status: typeof status === "number" ? status : null, endpoint_host };
        } catch (e) {
          const status = statusOf(e);
          if (GONE.has(status)) {
            dead.push(sub.endpoint);
            row = { ...base, outcome: "gone", reason: `http_${status}`, status, endpoint_host };
          } else {
            console.error("push failed", status);
            row = { ...base, outcome: "failed", reason: status ? `http_${status}` : "network", status: status || null, endpoint_host };
          }
        }
        await record(deps, row);
      }),
    );
  }
  await deps.done(id, dead);
  return Response.json({ sent, dead: dead.length });
}
