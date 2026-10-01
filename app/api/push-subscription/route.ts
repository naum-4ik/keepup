// app/api/push-subscription/route.ts
import { NextResponse } from "next/server";
import { errorCode } from "@/lib/habit-errors";
import { parsePushSubscriptionRequest } from "@/lib/push-subscription-request";
import { createClient } from "@/lib/supabase/server";

// The browser replaced this device's push subscription (public/sw.js, pushsubscriptionchange): save
// the new one for whoever is signed in. The RPC applies every rule (known push service, takeover, cap).
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

  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.sub.endpoint,
    p_p256dh: parsed.sub.p256dh,
    p_auth: parsed.sub.auth,
    p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) return NextResponse.json({ error: errorCode(error) ?? "failed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
