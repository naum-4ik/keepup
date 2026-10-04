// app/api/check-ins/sync/route.ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { errorCode } from "@/lib/habit-errors";
import type { QueueEntry } from "@/lib/offline-queue";
import { parseEntry } from "@/lib/offline-sync";
import { isSameOrigin } from "@/lib/review-request";
import { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

// One queued entry. The RPC decides everything (ideas/offline.md): which day counts, duplicates,
// the 3-day window, undo rules.
type Sent = { landed: boolean; error: { message: string; code?: string } | null };

async function checkIn(db: Db, entry: Extract<QueueEntry, { kind: "check_in" }>, tappedAt: string | undefined): Promise<Sent> {
  const tap = { p_client_id: entry.clientId, ...(tappedAt ? { p_tapped_at: tappedAt } : {}) };
  const { data, error } = entry.subjectId
    ? await db.rpc("check_in_for", { p_habit_id: entry.habitId, p_child_id: entry.subjectId, p_by_child: entry.byChild === true, ...tap })
    : await db.rpc("check_in", { p_habit_id: entry.habitId, ...tap });
  // Too old (over 3 days): the RPC keeps nothing and returns no row; its feed note explains.
  return { landed: Boolean((data as { id?: string | null } | null)?.id), error };
}

async function send(db: Db, entry: QueueEntry): Promise<Sent> {
  if (entry.kind === "undo") {
    const { data, error } = await db.rpc("undo_check_in_by_client", { p_client_id: entry.clientId });
    return { landed: data === true, error };
  }
  const first = await checkIn(db, entry, entry.tappedAt);
  // The phone's clock runs ahead (over 5 minutes): rather than lose the tap, count it now, once.
  if (errorCode(first.error) === "tap_in_future") return checkIn(db, entry, undefined);
  return first;
}

// One entry is a few hundred bytes; anything near this is not from the app.
const MAX_BODY_BYTES = 16 * 1024;

// The body as text, or null when it is over MAX_BODY_BYTES (by its Content-Length, or by what arrives:
// a chunked body has no length).
async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text().catch(() => "");
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The page's offline queue posts here, one entry at a time (lib/offline-sync.ts outcomeFor reads
// the answer): 200 synced or rejected, 400/409/413 never retried, 401/503 tried again later.
// No per-user rate limit, on purpose: each request carries exactly one entry (at most 16 KB), needs a
// signed-in session, and is idempotent (client_id: a resend never counts twice), and the client backs
// off (3 s, 9 s, 30 s, then every 5 min). An in-memory counter means nothing on serverless (each
// instance has its own) and a database one would cost a write per request; the RPCs' own rules are
// the limit that matters.
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const text = await readBody(request);
  if (text === null) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const entry = parseEntry(parseJson(text));
  if (!entry) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { landed, error } = await send(supabase, entry);
  if (error) {
    const code = errorCode(error);
    if (code === "not_authenticated") return NextResponse.json({ error: code }, { status: 401 });
    if (!code) console.error("offline sync", error.message);
    return code ? NextResponse.json({ error: code }, { status: 409 }) : NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath(`/habits/${entry.habitId}`);
  if (entry.kind === "check_in" && entry.subjectId) {
    revalidatePath(`/kids/${entry.subjectId}`);
    revalidatePath(`/kids/${entry.subjectId}/play`);
  }
  return NextResponse.json({ outcome: landed ? "synced" : "rejected" });
}
