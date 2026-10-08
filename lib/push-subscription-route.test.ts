// The push-subscription route (app/api/push-subscription/route.ts) with a stand-in Supabase client.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, auth: { getClaims } }) }));

const { POST } = await import("@/app/api/push-subscription/route");

const FCM = "https://fcm.googleapis.com/fcm/send/";
const SUB = { endpoint: `${FCM}new`, p256dh: "p", auth: "a" };

function post(body: unknown) {
  return POST(new Request("https://keepup.test/api/push-subscription", {
    method: "POST",
    headers: { host: "keepup.test", origin: "https://keepup.test", "content-type": "application/json", "user-agent": "Phone" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  rpc.mockReset();
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: "u1" } } });
});

describe("POST /api/push-subscription", () => {
  it("a rotation is one call: rotate_push_subscription with the old endpoint", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await post({ ...SUB, oldEndpoint: `${FCM}old` });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rotate_push_subscription", {
      p_old_endpoint: `${FCM}old`, p_endpoint: `${FCM}new`, p_p256dh: "p", p_auth: "a", p_user_agent: "Phone",
    });
  });

  it("the re-save on open is one call: refresh_push_subscription", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await post({ ...SUB, refresh: true })).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("refresh_push_subscription", { p_endpoint: `${FCM}new`, p_p256dh: "p", p_auth: "a", p_user_agent: "Phone" });
  });

  it("a removed device (the database saved nothing) is 204; a refused save 409 with its code", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await post({ ...SUB, refresh: true })).status).toBe(204);
    rpc.mockResolvedValue({ data: null, error: { message: "keepup:invalid_subscription" } });
    const refused = await post({ ...SUB, oldEndpoint: `${FCM}old` });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "invalid_subscription" });
  });

  it("no session: 401, nothing called", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect((await post({ ...SUB, refresh: true })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
