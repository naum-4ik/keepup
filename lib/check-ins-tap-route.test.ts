// The online tap route (app/api/check-ins/tap/route.ts) with a stand-in Supabase client.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();
const ledger = vi.fn();
const revalidatePath = vi.fn();
const query = { select: () => query, eq: () => query, maybeSingle: () => ledger() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, auth: { getClaims }, from: () => query }) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
// after() runs its callback once the response is out; here, when the test says so.
const afterTasks: (() => Promise<void>)[] = [];
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (task: () => Promise<void>) => afterTasks.push(task) }));
const logEvent = vi.fn();
vi.mock("@/lib/telemetry", async (original) => ({ userAttributes: (await original<typeof import("@/lib/telemetry")>()).userAttributes, tagUser: () => {}, logEvent: (...args: unknown[]) => logEvent(...args), flushLogs: async () => {} }));

const { POST } = await import("@/app/api/check-ins/tap/route");

const H = "00000000-0000-0000-0000-0000000000d1";
const C = "c0000000-0000-4000-8000-000000000001";
const K = "00000000-0000-0000-0000-0000000000f1";

function post(body: unknown, origin = "https://keepup.test") {
  return POST(new Request("https://keepup.test/api/check-ins/tap", {
    method: "POST", headers: { host: "keepup.test", origin, "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}
const row = (over: Record<string, unknown> = {}) => ({ id: "row1", status: "approved", client_id: C, created_at: new Date().toISOString(), ...over });

beforeEach(() => {
  afterTasks.length = 0;
  logEvent.mockReset();
  rpc.mockReset();
  ledger.mockReset().mockResolvedValue({ data: { amount: 12 }, error: null });
  revalidatePath.mockReset();
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: "u1" } } });
});

describe("POST /api/check-ins/tap", () => {
  it("refuses another site (403), a bad body (400) and no session (401)", async () => {
    expect((await post({ clientId: C, habitId: H }, "https://evil.example")).status).toBe(403);
    expect((await post({ clientId: "x", habitId: H })).status).toBe(400);
    getClaims.mockResolvedValue({ data: null });
    expect((await post({ clientId: C, habitId: H })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks me in by the tap's id only (the server's clock), refreshes the pages and returns the XP", async () => {
    rpc.mockResolvedValue({ data: row(), error: null });
    const res = await post({ clientId: C, habitId: H, subjectId: null, tappedAt: "2026-10-05T20:58:00Z" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ xp: 12 });
    expect(rpc).toHaveBeenCalledWith("check_in", { p_habit_id: H, p_client_id: C });
    expect(revalidatePath).toHaveBeenCalledWith("/today");
    expect(revalidatePath).toHaveBeenCalledWith(`/habits/${H}`);
  });

  it("a resend of a tap that already landed floats nothing", async () => {
    rpc.mockResolvedValue({ data: row({ created_at: "2026-01-01T00:00:00Z" }), error: null });
    expect(await (await post({ clientId: C, habitId: H })).json()).toEqual({ xp: 0 });
  });

  it("a child's tap uses check_in_for, refreshes the child's pages and floats nothing", async () => {
    rpc.mockResolvedValue({ data: row(), error: null });
    expect(await (await post({ clientId: C, habitId: H, subjectId: K, byChild: true })).json()).toEqual({ xp: 0 });
    expect(rpc).toHaveBeenCalledWith("check_in_for", { p_habit_id: H, p_child_id: K, p_by_child: true, p_client_id: C });
    expect(revalidatePath).toHaveBeenCalledWith(`/kids/${K}/play`);
  });

  it("a rule's refusal is a 409 with its code and words; anything else a 503 without a code", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "keepup:habit_frozen" } });
    const refused = await post({ clientId: C, habitId: H });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "habit_frozen", message: expect.any(String) });
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const failed = await post({ clientId: C, habitId: H });
    expect(failed.status).toBe(503);
    expect(await failed.json()).not.toHaveProperty("code");
  });
});

describe("POST /api/check-ins/tap: the keepup.check_in event", () => {
  const runAfter = () => Promise.all(afterTasks.map((task) => task()));

  it("is sent after the response, with who, which habit (named) and the XP", async () => {
    rpc.mockResolvedValue({ data: row(), error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "anna@example.com" } } });
    ledger.mockResolvedValueOnce({ data: { amount: 12 }, error: null }).mockResolvedValue({ data: { title: "Brush teeth", category: "health" }, error: null });
    await post({ clientId: C, habitId: H });
    expect(logEvent).not.toHaveBeenCalled();
    await runAfter();
    expect(logEvent).toHaveBeenCalledWith(
      "keepup.check_in",
      expect.objectContaining({ "user.id": "u1", "user.email": "anna@example.com", "habit.id": H, "habit.title": "Brush teeth", "check_in.outcome": "saved", "check_in.xp": 12 }),
      "INFO",
    );
  });

  it("names the child on a child's tap, and says why a rule refused it", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "keepup:already_done" } });
    ledger.mockResolvedValueOnce({ data: { title: "Brush teeth", category: "health" } }).mockResolvedValueOnce({ data: { display_name: "Mary" } });
    await post({ clientId: C, habitId: H, subjectId: K, byChild: true });
    await runAfter();
    const [, fields] = logEvent.mock.calls[0];
    expect(fields).toMatchObject({ "child.id": K, "child.nickname": "Mary", "check_in.by_child": true, "check_in.outcome": "refused" });
  });

  it("an unexpected database error is an ERROR event", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    await post({ clientId: C, habitId: H });
    await runAfter();
    expect(logEvent).toHaveBeenCalledWith("keepup.check_in", expect.objectContaining({ "check_in.outcome": "failed", "check_in.reason": "connection reset" }), "ERROR");
  });
});
