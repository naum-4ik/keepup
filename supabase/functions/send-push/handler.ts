// supabase/functions/send-push/handler.ts
// The webhook body: {"id": "<notification id>"}. One push per device; 404/410 = the device is gone.
import { buildPush, type PushJob } from "./build.ts";

export type Subscription = PushJob["subscriptions"][number];
export type Deps = {
  secret: string;
  loadJob(id: string): Promise<PushJob | null>;
  send(sub: Subscription, payload: string): Promise<void>;
  done(id: string, deadEndpoints: string[]): Promise<void>;
};

const GONE = new Set([404, 410]);
const statusOf = (e: unknown): number =>
  typeof e === "object" && e !== null && "statusCode" in e ? Number((e as { statusCode: unknown }).statusCode) : 0;

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!deps.secret || req.headers.get("x-keepup-push-secret") !== deps.secret) return new Response("forbidden", { status: 403 });

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const job = await deps.loadJob(id);
  if (!job || job.pushed) return Response.json({ skipped: true });

  const payload = buildPush(job);
  const dead: string[] = [];
  let sent = 0;
  if (payload) {
    const text = JSON.stringify(payload);
    await Promise.all(
      job.subscriptions.map(async (sub) => {
        try {
          await deps.send(sub, text);
          sent++;
        } catch (e) {
          if (GONE.has(statusOf(e))) dead.push(sub.endpoint);
          else console.error("push failed", statusOf(e));
        }
      }),
    );
  }
  await deps.done(id, dead);
  return Response.json({ sent, dead: dead.length });
}
