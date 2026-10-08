// supabase/functions/send-push/index.ts
// Called by the notifications webhook (private.dispatch_push). The service-role key and the VAPID
// private key exist only here, as Supabase secrets.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import type { PushJob } from "./build.ts";
import { type Deps, handle } from "./handler.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// Checked once at startup; handle() answers 500 while they're missing. Never log the values.
function setUpVapid(): boolean {
  if (!env("VAPID_PUBLIC_KEY") || !env("VAPID_PRIVATE_KEY") || !env("VAPID_SUBJECT")) {
    console.error("send-push: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT is not set");
    return false;
  }
  try {
    webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
    return true;
  } catch {
    console.error("send-push: VAPID keys or subject are malformed");
    return false;
  }
}

const deps: Deps = {
  secret: env("PUSH_WEBHOOK_SECRET"),
  pushConfigured: setUpVapid(),
  async loadJob(id) {
    const { data, error } = await db.rpc("push_job", { p_id: id });
    if (error) throw new Error(`push_job: ${error.message}`);
    return (data as PushJob | null) ?? null;
  },
  async send(sub, payload) {
    // 12h TTL: a phone that's off for the night still gets the push in the morning. 10s timeout: a
    // hung push service must not keep the function running.
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      TTL: 12 * 60 * 60,
      timeout: 10_000,
    });
  },
  async done(id, dead) {
    const { error } = await db.rpc("push_done", { p_id: id, p_dead_endpoints: dead });
    if (error) throw new Error(`push_done: ${error.message}`);
  },
};

Deno.serve((req) => handle(req, deps));
