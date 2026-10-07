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
