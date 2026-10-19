import { describe, expect, it, vi } from "vitest";
import { reach } from "./reach";

const messages = { offline: "offline", reload: "reload" };

describe("reach", () => {
  it("passes the action's answer through", async () => {
    expect(await reach(async () => ({ ok: true as const, n: 1 }), messages, { online: () => true })).toEqual({ ok: true, n: 1 });
  });

  it("sends nothing offline and says to check the connection", async () => {
    const call = vi.fn(async () => ({ ok: true }));
    expect(await reach(call, messages, { online: () => false })).toEqual({ ok: false, message: "offline" });
    expect(call).not.toHaveBeenCalled();
  });

  it("says to reload when the request dies while online", async () => {
    expect(await reach(async () => Promise.reject(new Error("500")), messages, { online: () => true })).toEqual({ ok: false, message: "reload" });
  });

  it("says to check the connection when it died because the phone went offline", async () => {
    let online = true;
    const call = async () => {
      online = false;
      throw new Error("network");
    };
    expect(await reach(call, messages, { online: () => online })).toEqual({ ok: false, message: "offline" });
  });

  it("rethrows what rethrow throws (a redirect), so it still happens", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    const rethrow = (e: unknown) => {
      if (e === redirect) throw e;
    };
    await expect(reach(async () => Promise.reject(redirect), messages, { online: () => true, rethrow })).rejects.toBe(redirect);
  });
});
