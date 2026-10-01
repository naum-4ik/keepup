// supabase/functions/send-push/index.ts
// Called by the notifications webhook (private.dispatch_push). The service-role key and the VAPID
// private key exist only here, as Supabase secrets.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import type { PushJob } from "./build.ts";
import { type Deps, handle } from "./handler.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

let vapidReady = false;
function vapid() {
  if (vapidReady) return;
  if (!env("VAPID_PUBLIC_KEY") || !env("VAPID_PRIVATE_KEY") || !env("VAPID_SUBJECT")) throw new Error("VAPID keys missing");
  webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  vapidReady = true;
}

const deps: Deps = {
  secret: env("PUSH_WEBHOOK_SECRET"),
  async loadJob(id) {
    const { data, error } = await db.rpc("push_job", { p_id: id });
    if (error) throw new Error(`push_job: ${error.message}`);
    return (data as PushJob | null) ?? null;
  },
  async send(sub, payload) {
    vapid();
    // 12h TTL: a phone that's off for the night still gets the push in the morning.
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 12 * 60 * 60 });
  },
  async done(id, dead) {
    const { error } = await db.rpc("push_done", { p_id: id, p_dead_endpoints: dead });
    if (error) throw new Error(`push_done: ${error.message}`);
  },
};

Deno.serve((req) => handle(req, deps));
