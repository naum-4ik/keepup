// The sync route (app/api/check-ins/sync/route.ts) with a stand-in Supabase client.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();
const revalidatePath = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, auth: { getClaims } }) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const { POST } = await import("@/app/api/check-ins/sync/route");

const H = "00000000-0000-0000-0000-0000000000d1";
const C = "c0000000-0000-4000-8000-000000000001";
const K = "00000000-0000-0000-0000-0000000000f1";
const TAP = { kind: "check_in", clientId: C, habitId: H, subjectId: null, tappedAt: "2026-10-05T20:58:00.000Z" };

function post(body: unknown, origin: string | null = "https://keepup.test") {
  const headers: Record<string, string> = { host: "keepup.test", "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return POST(new Request("https://keepup.test/api/check-ins/sync", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

beforeEach(() => {
  rpc.mockReset();
  revalidatePath.mockReset();
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: "u1" } } });
});

describe("POST /api/check-ins/sync", () => {
  it("refuses another site (403), a bad body (400) and no session (401)", async () => {
    expect((await post(TAP, "https://evil.example")).status).toBe(403);
    expect((await post("not json")).status).toBe(400);
    expect((await post({ ...TAP, clientId: "x" })).status).toBe(400);
    getClaims.mockResolvedValue({ data: null });
    expect((await post(TAP)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a queued tap is sent with its id and time, and the pages it changes are refreshed", async () => {
    rpc.mockResolvedValue({ data: { id: "row" }, error: null });
    const res = await post({ ...TAP, subjectId: K, byChild: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "synced" });
    expect(rpc).toHaveBeenCalledWith("check_in_for", {
      p_habit_id: H, p_child_id: K, p_by_child: true, p_client_id: C, p_tapped_at: "2026-10-05T20:58:00.000Z",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/today");
    expect(revalidatePath).toHaveBeenCalledWith(`/habits/${H}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/kids/${K}/play`);
  });

  it("too old: nothing kept, so rejected (the feed note explains)", async () => {
    rpc.mockResolvedValue({ data: { id: null }, error: null });
    expect(await (await post(TAP)).json()).toEqual({ outcome: "rejected" });
  });

  it("a rule refusal is 409 with its code; a server problem is 503; an expired session 401", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "keepup:habit_archived" } });
    const refused = await post(TAP);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "habit_archived" });
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect((await post(TAP)).status).toBe(503);
    rpc.mockResolvedValue({ data: null, error: { message: "keepup:not_authenticated" } });
    expect((await post(TAP)).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a phone clock far ahead: sent once more without the time, so it counts now", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "keepup:tap_in_future" } })
      .mockResolvedValueOnce({ data: { id: "row" }, error: null });
    expect(await (await post(TAP)).json()).toEqual({ outcome: "synced" });
    expect(rpc).toHaveBeenNthCalledWith(2, "check_in", { p_habit_id: H, p_client_id: C });
  });

  it("an undo uses its client id", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await (await post({ kind: "undo", clientId: C, habitId: H })).json()).toEqual({ outcome: "synced" });
    expect(rpc).toHaveBeenCalledWith("undo_check_in_by_client", { p_client_id: C });
  });
});
