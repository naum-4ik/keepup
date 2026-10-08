import { describe, expect, it } from "vitest";
import { DELETE_FAILED, deletePreviewLines, isDeleteWord, myDataFileName, runDelete } from "./my-data";

describe("my data", () => {
  it("accepts 'delete' typed loosely", () => {
    expect(isDeleteWord(" Delete ")).toBe(true);
    expect(isDeleteWord("del")).toBe(false);
  });
  it("names the export by date", () => {
    expect(myDataFileName(new Date("2026-10-07T12:00:00Z"))).toBe("keepup-my-data-2026-10-07.json");
  });
  it("explains what goes and who takes over", () => {
    expect(
      deletePreviewLines({
        groups_deleted: [{ name: "Solo", children: ["Leo"] }, { name: "Book", children: [] }],
        admin_handover: [{ group: "Family", new_admin: "Ben" }],
      }),
    ).toEqual(["Solo will be deleted, with Leo's profile.", "Book will be deleted.", "Ben becomes the admin of Family."]);
  });
  it("says nothing extra when no group is affected", () => {
    expect(deletePreviewLines({ groups_deleted: [], admin_handover: [] })).toEqual([]);
  });
});

describe("runDelete", () => {
  function steps(result: { ok: false; message: string } | undefined) {
    const calls: string[] = [];
    return {
      calls,
      deps: {
        flush: async () => void calls.push("flush"),
        clearPhone: async () => void calls.push("clear"),
        remove: async () => (calls.push("delete"), result),
        rethrow: () => undefined,
      },
    };
  }
  it("sends waiting check-ins, then clears the phone, then deletes", async () => {
    const { calls, deps } = steps(undefined);
    expect(await runDelete(deps)).toBeNull();
    expect(calls).toEqual(["flush", "clear", "delete"]);
  });
  it("asks for a reload when the delete fails (the phone was already cleared)", async () => {
    const { deps } = steps({ ok: false, message: "Something went wrong. Try again." });
    expect(await runDelete(deps)).toBe(DELETE_FAILED);
  });
  it("still clears and deletes when the send fails", async () => {
    const { calls, deps } = steps(undefined);
    deps.flush = async () => {
      calls.push("flush");
      throw new Error("offline");
    };
    expect(await runDelete(deps)).toBeNull();
    expect(calls).toEqual(["flush", "clear", "delete"]);
  });
});

describe("runDelete: the action's redirect", () => {
  const TO_LANDING = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/?deleted=1;307;" });
  const base = {
    flush: async () => undefined,
    clearPhone: async () => undefined,
    rethrow: (e: unknown) => { if (e === TO_LANDING) throw e; },
  };
  it("a successful delete redirects: passed on, never DELETE_FAILED", async () => {
    await expect(runDelete({ ...base, remove: async () => { throw TO_LANDING; } })).rejects.toBe(TO_LANDING);
  });
  it("the delete call itself breaks (network): DELETE_FAILED", async () => {
    expect(await runDelete({ ...base, remove: async () => { throw new TypeError("Failed to fetch"); } })).toBe(DELETE_FAILED);
  });
  it("clearing the phone breaks: DELETE_FAILED, and nothing is deleted", async () => {
    let removed = false;
    const clearPhone = async () => { throw new Error("no storage"); };
    expect(await runDelete({ ...base, clearPhone, remove: async () => void (removed = true) })).toBe(DELETE_FAILED);
    expect(removed).toBe(false);
  });
});
