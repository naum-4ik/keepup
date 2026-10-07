import { afterEach, describe, expect, it, vi } from "vitest";
import { claimSavedPages, markPagesOwnerDeleted } from "./offline-pages";

function phone(owner: string | null) {
  const store = new Map<string, string>(owner ? [["keepup-pages-owner", owner]] : []);
  const deleted: string[] = [];
  const caches = { delete: async (name: string) => (deleted.push(name), true) };
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("caches", caches);
  vi.stubGlobal("window", { caches });
  return { store, deleted };
}

afterEach(() => vi.unstubAllGlobals());

describe("saved offline pages after a deleted account", () => {
  it("keeps an owner, so the next account's claim still wipes leftover pages", async () => {
    const { store, deleted } = phone("user-a");
    markPagesOwnerDeleted();
    expect(store.get("keepup-pages-owner")).toBe("deleted");
    await claimSavedPages("user-b");
    expect(deleted).toEqual(["keepup-pages"]);
    expect(store.get("keepup-pages-owner")).toBe("user-b");
  });
  it("leaves the same person's pages alone", async () => {
    const { deleted } = phone("user-a");
    await claimSavedPages("user-a");
    expect(deleted).toEqual([]);
  });
});
