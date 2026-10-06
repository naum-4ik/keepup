import { NextResponse } from "next/server";
import { parseSeen } from "@/lib/celebrations";
import { getPendingCelebrations } from "@/lib/celebrations-data";
import { isSameOrigin } from "@/lib/review-request";
import { createClient } from "@/lib/supabase/server";

// The moment's reads and writes (components/celebrations/celebration-moment.tsx). A route, not server
// actions: actions run one at a time, so these would hold up the next check-in.

// What to show when a page opens.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  return NextResponse.json(await getPendingCelebrations(), { headers: { "Cache-Control": "no-store" } });
}

// Marked seen when shown, so leaving mid-moment never shows it twice. Seeing a level marks every lower
// one seen too.
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) return new NextResponse(null, { status: 403 });
  const item = parseSeen(await request.json().catch(() => null));
  if (!item) return new NextResponse(null, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { error } =
    "level" in item
      ? await supabase.rpc("mark_levels_seen", { p_up_to: item.level })
      : await supabase.rpc("mark_badges_seen", { p_codes: [item.badge] });
  if (error) {
    console.error("marking a celebration seen failed", error.message);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
