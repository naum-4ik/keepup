// app/api/check-ins/[id]/review/route.ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { errorCode } from "@/lib/habit-errors";
import { track } from "@/lib/log";
import { parseReviewRequest } from "@/lib/review-request";
import { createClient } from "@/lib/supabase/server";
import { userAttributes } from "@/lib/telemetry";

// Approve / Don't approve from a notification (spec: Pipeline). The RPC applies every rule: a
// current member, not the author, still pending, before the deadline.
export async function POST(request: Request, ctx: RouteContext<"/api/check-ins/[id]/review">) {
  const { id } = await ctx.params;
  const parsed = parseReviewRequest({
    id,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    body: await request.json().catch(() => null),
  });
  if (!parsed.ok) return NextResponse.json({ error: "bad_request" }, { status: parsed.status });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { error } = await supabase.rpc("review_check_in", { p_check_in_id: parsed.checkInId, p_approve: parsed.approve });
  if (error) return NextResponse.json({ error: errorCode(error) ?? "failed" }, { status: 409 });
  track("check_in_reviewed", userAttributes(data.claims), { "check_in.id": parsed.checkInId, "review.decision": parsed.approve ? "approve" : "reject", "review.count": 1 });
  revalidatePath("/inbox");
  revalidatePath("/today");
  return NextResponse.json({ ok: true });
}
