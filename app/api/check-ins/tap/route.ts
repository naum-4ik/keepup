// app/api/check-ins/tap/route.ts
import { trace } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { errorCode, habitErrorMessage, REFRESH_ON_ERROR } from "@/lib/habit-errors";
import { parseTap, type OnlineTap } from "@/lib/offline-sync";
import { parseJson, readBody } from "@/lib/request-body";
import { isSameOrigin } from "@/lib/review-request";
import { createClient } from "@/lib/supabase/server";
import { tagUser } from "@/lib/telemetry";
import { countsNow } from "@/lib/xp";

// The pages that show a check-in on this habit (and the child's, for a tap for a child).
function refresh(tap: OnlineTap) {
  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath(`/habits/${tap.habitId}`);
  if (tap.subjectId) {
    revalidatePath("/groups/[id]", "page");
    revalidatePath(`/kids/${tap.subjectId}`);
    revalidatePath(`/kids/${tap.subjectId}/play`);
  }
}

// A check-in tap tried online (lib/offline-client.ts submitTap; lib/offline-sync.ts tapSender reads
// the answer). It is a plain request, not a server action, so the page can stop waiting for it: after
// TAP_TIMEOUT_MS the phone aborts it and keeps the tap queued, and nothing a late answer carries ever
// reaches the screen (an action's answer would redraw the page, and React holds every transition
// until it arrives). The tap carries its client id only; the server's clock decides the day.
// 200 { xp }: it counted (xp: what it earned, null when the ledger couldn't be read, 0 for nothing to
// float). 409 { code, message }: a rule refused it (final). 401: no session. 503: anything else.
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const text = await readBody(request);
  if (text === null) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const tap = parseTap(parseJson(text));
  if (!tap) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ code: "not_authenticated" }, { status: 401 });
  tagUser(claims.claims);
  trace.getActiveSpan()?.setAttributes({ "habit.id": tap.habitId, ...(tap.subjectId && { "child.id": tap.subjectId }) });

  const startedAt = Date.now();
  const { data, error } = tap.subjectId
    ? await supabase.rpc("check_in_for", { p_habit_id: tap.habitId, p_child_id: tap.subjectId, p_by_child: tap.byChild === true, p_client_id: tap.clientId })
    : await supabase.rpc("check_in", { p_habit_id: tap.habitId, p_client_id: tap.clientId });
  if (error) {
    const code = errorCode(error);
    if (code === "not_authenticated") return NextResponse.json({ code }, { status: 401 });
    if (code && REFRESH_ON_ERROR.has(code)) refresh(tap);
    if (!code) console.error("check-in tap", error.message);
    return code
      ? NextResponse.json({ code, message: habitErrorMessage(error) }, { status: 409 })
      : NextResponse.json({ message: habitErrorMessage(error) }, { status: 503 });
  }
  refresh(tap);
  // XP floats only for my own counted row this request inserted, not a resend's or a merge's (lib/xp.ts).
  const row = data as { id: string; status: string; client_id: string | null; created_at: string } | null;
  if (tap.subjectId || !row || !countsNow(row, tap, startedAt)) return NextResponse.json({ xp: 0 });
  // The amount the database granted (10, + the streak on the period's first, rewards_on_check_in), read
  // back from the ledger (RLS: own rows). Fails soft: "+XP" with no number.
  const { data: granted, error: readError } = await supabase
    .from("xp_events")
    .select("amount")
    .eq("reason", "check_in")
    .eq("source_type", "check_in")
    .eq("source_id", row.id)
    .maybeSingle();
  if (readError) console.error("check-in XP read failed", readError.message);
  return NextResponse.json({ xp: granted?.amount ?? null });
}
