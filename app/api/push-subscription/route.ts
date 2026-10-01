// app/api/push-subscription/route.ts
import { NextResponse } from "next/server";
import { errorCode } from "@/lib/habit-errors";
import { applyPushSubscriptionUpdate, parsePushSubscriptionRequest } from "@/lib/push-subscription-request";
import { createClient } from "@/lib/supabase/server";

// Saves this device's push subscription again, for whoever is signed in, but only while this account
// still has the device (lib/push-subscription-request.ts): the app's re-save on open (`refresh`), and
// the service worker's pushsubscriptionchange (`oldEndpoint`). The RPC applies the rest (known push
// service, takeover, cap).
export async function POST(request: Request) {
  const parsed = parsePushSubscriptionRequest({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    body: await request.json().catch(() => null),
  });
  if (!parsed.ok) return NextResponse.json({ error: "bad_request" }, { status: parsed.status });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);
  const outcome = await applyPushSubscriptionUpdate(parsed, {
    // RLS: a person reads only their own rows.
    owns: async (endpoint) => {
      const { data: row, error } = await supabase.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint).maybeSingle();
      if (error) console.error("push subscription lookup", error.message);
      return Boolean(row);
    },
    save: async (sub) => {
      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_user_agent: userAgent,
      });
      return error ? { ok: false, code: errorCode(error) } : { ok: true };
    },
    forget: async (endpoint) => {
      const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
      if (error) console.error("push subscription delete", error.message);
    },
  });
  if (outcome.status === 204) return new NextResponse(null, { status: 204 });
  if (outcome.status === 409) return NextResponse.json({ error: outcome.code ?? "failed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
