import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { deletePreviewLines, isDeleteWord, myDataFileName, runDelete } from "./my-data";

describe("my data", () => {
  it("accepts 'delete' typed loosely", () => {
    expect(isDeleteWord(tEn, " Delete ")).toBe(true);
    expect(isDeleteWord(tEn, "del")).toBe(false);
  });
  it("names the export by date", () => {
    expect(myDataFileName(new Date("2026-10-07T12:00:00Z"), "UTC")).toBe("keepup-my-data-2026-10-07.json");
  });
  it("names the export by the person's own date, not UTC's", () => {
    // 23:30 UTC is already the next morning in Rome, and still the evening before in Los Angeles.
    expect(myDataFileName(new Date("2026-10-07T23:30:00Z"), "Europe/Rome")).toBe("keepup-my-data-2026-10-08.json");
    expect(myDataFileName(new Date("2026-10-08T03:00:00Z"), "America/Los_Angeles")).toBe("keepup-my-data-2026-10-07.json");
  });
  it("explains what goes and who takes over", () => {
    expect(
      deletePreviewLines(tEn, "en", {
        groups_deleted: [{ name: "Solo", children: ["Leo"] }, { name: "Book", children: [] }],
        admin_handover: [{ group: "Family", new_admin: "Ben" }],
      }),
    ).toEqual([
      "\u2068Solo\u2069 will be deleted, with \u2068Leo\u2069's profile.",
      "\u2068Book\u2069 will be deleted.",
      "\u2068Ben\u2069 becomes the admin of \u2068Family\u2069.",
    ]);
  });
  it("lists several children with their own possessives", () => {
    expect(deletePreviewLines(tEn, "en", { groups_deleted: [{ name: "Home", children: ["Leo", "Mia"] }], admin_handover: [] })).toEqual([
      "\u2068Home\u2069 will be deleted, with \u2068Leo\u2069's and \u2068Mia\u2069's profiles.",
    ]);
  });
  it("says nothing extra when no group is affected", () => {
    expect(deletePreviewLines(tEn, "en", { groups_deleted: [], admin_handover: [] })).toEqual([]);
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
    expect(await runDelete(tEn, deps)).toBeNull();
    expect(calls).toEqual(["flush", "clear", "delete"]);
  });
  it("asks for a reload when the delete fails (the phone was already cleared)", async () => {
    const { deps } = steps({ ok: false, message: "Something went wrong. Try again." });
    expect(await runDelete(tEn, deps)).toBe(tEn("myData.deleteFailed"));
  });
  it("still clears and deletes when the send fails", async () => {
    const { calls, deps } = steps(undefined);
    deps.flush = async () => {
      calls.push("flush");
      throw new Error("offline");
    };
    expect(await runDelete(tEn, deps)).toBeNull();
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
    await expect(runDelete(tEn, { ...base, remove: async () => { throw TO_LANDING; } })).rejects.toBe(TO_LANDING);
  });
  it("the delete call itself breaks (network): DELETE_FAILED", async () => {
    expect(await runDelete(tEn, { ...base, remove: async () => { throw new TypeError("Failed to fetch"); } })).toBe(tEn("myData.deleteFailed"));
  });
  it("clearing the phone breaks: DELETE_FAILED, and nothing is deleted", async () => {
    let removed = false;
    const clearPhone = async () => { throw new Error("no storage"); };
    expect(await runDelete(tEn, { ...base, clearPhone, remove: async () => void (removed = true) })).toBe(tEn("myData.deleteFailed"));
    expect(removed).toBe(false);
  });
});
