// "Try it" step 2 (app/demo/actions.ts startDemo) with a stand-in Supabase client: the visitor's
// language names the group and the treat; an older database (deploy order) still seeds in English.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, auth: { getClaims: async () => ({ data: { claims: { is_anonymous: true } } }), signOut } }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getT: async () => ({ t: (k: string) => ({ "groups.defaultFamily": "Семья", "templates.treat.playground": "Поход на детскую площадку" })[k] ?? k }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));
vi.mock("@/lib/geo", () => ({ whereFrom: async () => ({}) }));
vi.mock("@/lib/log", () => ({ track: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ userAttributes: () => ({}) }));

const { startDemo } = await import("@/app/demo/actions");

const form = () => { const f = new FormData(); f.set("timezone", "Europe/Berlin"); return f; };

beforeEach(() => {
  rpc.mockReset();
  signOut.mockReset();
});

describe("startDemo", () => {
  it("seeds with the group and treat names in the visitor's language", async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(startDemo(form())).rejects.toThrow("redirect:/today");
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("start_demo", {
      p_timezone: "Europe/Berlin", p_group_name: "Семья", p_treat_title: "Поход на детскую площадку",
    });
  });

  it("retries with the time zone only when the database doesn't know the new params yet", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "Could not find the function" } }).mockResolvedValueOnce({ error: null });
    await expect(startDemo(form())).rejects.toThrow("redirect:/today");
    expect(rpc).toHaveBeenLastCalledWith("start_demo", { p_timezone: "Europe/Berlin" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("any other failure ends the demo without a retry", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "keepup:not_demo" } });
    await expect(startDemo(form())).rejects.toThrow("redirect:/?demo=failed");
    expect(rpc).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalled();
  });
});
