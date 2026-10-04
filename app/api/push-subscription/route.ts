// app/api/push-subscription/route.ts
import { NextResponse } from "next/server";
import { errorCode } from "@/lib/habit-errors";
import { applyPushSubscriptionUpdate, parsePushSubscriptionRequest } from "@/lib/push-subscription-request";
import { createClient } from "@/lib/supabase/server";

// Saves this device's push subscription again, for whoever is signed in, but only while the device is
// still saved (lib/push-subscription-request.ts): the app's re-save on open (`refresh`), and the
// service worker's pushsubscriptionchange (`oldEndpoint`). Each RPC is one transaction and applies
// the rest (known push service, takeover, cap).
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
    refresh: async (sub) => {
      const { data: saved, error } = await supabase.rpc("refresh_push_subscription", {
        p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_user_agent: userAgent,
      });
      return error ? { ok: false, code: errorCode(error) } : { ok: true, saved: saved === true };
    },
    rotate: async (oldEndpoint, sub) => {
      const { data: saved, error } = await supabase.rpc("rotate_push_subscription", {
        p_old_endpoint: oldEndpoint, p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_user_agent: userAgent,
      });
      return error ? { ok: false, code: errorCode(error) } : { ok: true, saved: saved === true };
    },
  });
  if (outcome.status === 204) return new NextResponse(null, { status: 204 });
  if (outcome.status === 409) return NextResponse.json({ error: outcome.code ?? "failed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
