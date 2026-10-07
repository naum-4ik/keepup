import { describe, expect, it } from "vitest";
import { deletePreviewLines, isDeleteWord, myDataFileName } from "./my-data";

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
